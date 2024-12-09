import xml.etree.ElementTree as ET
import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
from eventlet.green import threading  # Use green threading
from backend.services.helpers.os_detector import OSDetector
from backend.services.scripts.docker.docker_manager import DockerManager
import eventlet
import shutil  # Add this import at the top
from xml.dom import minidom
import zipfile
import tempfile
import uuid  # Add this to the imports at the top

class DataPackage:
    def __init__(self):
        self.run_command = RunCommand()
        self.stop_event = threading.Event()
        self.os_detector = OSDetector()
        self.current_process = None

    def stop(self):
        """Stop the current configuration process"""
        self.stop_event.set()
        if self.current_process:
            self.current_process.kill()
            self.current_process = None
        socketio.emit('terminal_output', {'data': 'Configuration stopped by user'}, namespace='/data-package')
        socketio.emit('installation_failed', {'error': 'Configuration stopped by user'}, namespace='/data-package')

    def check_stop(self):
        if self.stop_event.is_set():
            if self.current_process:
                # Kill the current process
                self.current_process.kill()
                self.current_process = None
            raise Exception("Configuration stopped by user.")

    def generate_config_pref(self, preferences_data, temp_dir):
        """
        Generates the config.pref file in the temporary directory
        """
        self.check_stop()  # Check for stop event
        
        # Create the root element
        preferences = ET.Element('preferences')
        
        # First create the cot_streams preference
        cot_streams = ET.SubElement(preferences, 'preference')
        cot_streams.set('name', 'cot_streams')  # Set attributes individually to control order
        cot_streams.set('version', '1')
        
        # Get the count of CoT streams
        stream_count = int(preferences_data.get('count', 1))
        
        # Add count entry first
        count_entry = ET.SubElement(cot_streams, 'entry')
        count_entry.set('key', 'count')
        count_entry.set('class', 'class java.lang.Integer')
        count_entry.text = str(stream_count)
        
        # Base entries for each stream with default values
        base_entries = [
            ('description', 'String', ''),
            ('enabled', 'Boolean', 'False'),
            ('connectString', 'String', ''),
            ('caLocation', 'String', ''),
            ('certificateLocation', 'String', ''),
            ('clientPassword', 'String', ''),
            ('caPassword', 'String', '')
        ]
        
        # Add entries for each stream
        for i in range(stream_count):
            for base_key, class_type, default_value in base_entries:
                key = f"{base_key}{i}"
                entry = ET.SubElement(cot_streams, 'entry')
                entry.set('key', key)
                entry.set('class', f"class java.lang.{class_type}")
                
                # Get value from preferences or use default
                value = preferences_data.get(key, default_value)
                
                # Handle certificate paths
                if base_key in ['caLocation', 'certificateLocation'] and value:
                    # Remove any existing 'cert/' prefix to avoid duplication
                    clean_value = value.replace('cert/', '')
                    entry.text = f'cert/{clean_value}'
                else:
                    entry.text = str(value)
        
        # Create the main preferences section
        main_pref = ET.SubElement(preferences, 'preference')
        main_pref.set('name', 'com.atakmap.app.civ_preferences')
        main_pref.set('version', '1')
        
        # Read the template file to get the correct order
        template_path = os.path.join(os.path.dirname(__file__), 'preferences.xml')
        template_tree = ET.parse(template_path)
        template_root = template_tree.getroot()
        
        # Find the com.atakmap.app.civ_preferences section in template
        template_main = template_root.find(".//preference[@name='com.atakmap.app.civ_preferences']")
        
        # Add entries in the same order as template
        if template_main is not None:
            for template_entry in template_main.findall('entry'):
                key = template_entry.get('key')
                if key in preferences_data:
                    class_type = template_entry.get('class').split('.')[-1]
                    entry = ET.SubElement(main_pref, 'entry')
                    entry.set('key', key)
                    entry.set('class', f"class java.lang.{class_type}")
                    entry.text = str(preferences_data[key])
        
        # Convert to string
        rough_string = ET.tostring(preferences, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        
        # Create custom XML declaration and format
        xml_content = '<?xml version="1.0" standalone="yes"?>\n'
        xml_content += '\n'.join([node.toprettyxml(indent="", newl="\n") for node in reparsed.childNodes if node.nodeType == node.ELEMENT_NODE])
        
        # Write to file
        config_pref_path = os.path.join(temp_dir, 'initial.pref')
        
        socketio.emit('terminal_output', 
                     {'data': f'Creating config file at: {config_pref_path}'}, 
                     namespace='/data-package')
        
        with open(config_pref_path, 'w', encoding='utf-8') as file:
            file.write(xml_content)
            
        socketio.emit('terminal_output', 
                     {'data': 'Config file created successfully'}, 
                     namespace='/data-package')
        
    def generate_uuid(self):
        """
        Generates a random UUID for the manifest file.
        """
        return str(uuid.uuid4())

    def create_manifest_file(self, temp_dir, zip_name, ca_cert_name, client_cert_name):
        """
        Creates a clean manifest file in the temporary directory.
        Only includes certificate entries if valid certificate names are provided.
        """
        manifest_dir = os.path.join(temp_dir, 'MANIFEST')
        os.makedirs(manifest_dir, exist_ok=True)
        
        # Generate a random UUID
        package_uid = self.generate_uuid()
        
        # Start building the manifest content
        manifest_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<MissionPackageManifest version="2">
    <Configuration>
        <Parameter name="uid" value="{package_uid}"/>
        <Parameter name="name" value="{zip_name}.zip"/>
        <Parameter name="onReceiveDelete" value="true"/>
    </Configuration>
    <Contents>"""
        
        # Only add certificate entries if valid names are provided
        if ca_cert_name and ca_cert_name.strip():
            manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{ca_cert_name}"/>'
        if client_cert_name and client_cert_name.strip():
            manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{client_cert_name}"/>'
        
        # Always add the initial.pref entry
        manifest_content += f'\n        <Content ignore="false" zipEntry="initial.pref"/>'
        
        # Close the manifest content
        manifest_content += "\n    </Contents>\n</MissionPackageManifest>"

        manifest_path = os.path.join(manifest_dir, 'manifest.xml')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(manifest_content)
        
        self.run_command.emit_log_output(f'Manifest file created at: {manifest_path}', namespace='data-package')
        
    def get_takserver_container_name(self):
        """Get the TAK Server container name based on version"""
        try:
            version = self.read_version_txt()
            return f"takserver-{version}"
        except Exception as e:
            self.run_command.emit_log_output(
                f"Error getting container name: {str(e)}", 
                'data-package'
            )
            raise

    def copy_certificates_from_container(self, temp_dir, ca_cert_name, client_cert_name):
        """
        Copies the specified certificates from the container to the temporary directory.
        Only copies certificates if valid names are provided.
        """
        self.check_stop()
        container_name = self.get_takserver_container_name()

        # Create cert directory in temp directory
        cert_dir = os.path.join(temp_dir, 'cert')
        os.makedirs(cert_dir, exist_ok=True)

        # Only copy certificates if valid names are provided
        if ca_cert_name and ca_cert_name.strip():
            ca_cert_src = f"/opt/tak/certs/files/{ca_cert_name}"
            ca_cert_dest = os.path.join(cert_dir, ca_cert_name)
            copy_ca_cert_command = [
                'docker', 'cp', f"{container_name}:{ca_cert_src}", ca_cert_dest
            ]
            self.run_command.run_command(copy_ca_cert_command, namespace='data-package')

        if client_cert_name and client_cert_name.strip():
            client_cert_src = f"/opt/tak/certs/files/{client_cert_name}"
            client_cert_dest = os.path.join(cert_dir, client_cert_name)
            copy_client_cert_command = [
                'docker', 'cp', f"{container_name}:{client_cert_src}", client_cert_dest
            ]
            self.run_command.run_command(copy_client_cert_command, namespace='data-package')

        self.run_command.emit_log_output(f'Copied certificates to {cert_dir}', namespace='data-package')

    def get_default_working_directory(self):
        self.check_stop()  # Check for stop event
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type == 'windows' or os_type == 'macos':
            documents_dir = os.path.join(home_dir, 'Documents')
            # Ensure the Documents directory exists
            if not os.path.exists(documents_dir):
                os.makedirs(documents_dir)
            # Set the working directory to Documents/takserver-docker
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            # For Linux, use the home directory directly
            working_dir = os.path.join(home_dir, 'takserver-docker')
        return working_dir
    
    def create_data_package_directory(self):
        self.check_stop()  # Check for stop event
        working_dir = self.get_default_working_directory()
        data_package_dir = os.path.join(working_dir, 'data_package')
        
        # Emit progress message
        socketio.emit('terminal_output', {'data': f'Creating data package directory at: {data_package_dir}'}, namespace='/data-package')
        
        if not os.path.exists(data_package_dir):
            os.makedirs(data_package_dir)
            
        socketio.emit('terminal_output', {'data': 'Data package directory created'}, namespace='/data-package')
        return data_package_dir
    def read_version_txt(self):
        """
        Reads the version.txt file located in the working directory and returns the version.
        """
        self.check_stop()
        working_dir = self.get_default_working_directory()
        version_file_path = os.path.join(working_dir, "version.txt")

        if not os.path.exists(version_file_path):
            raise FileNotFoundError(f"version.txt not found in {working_dir}")

        with open(version_file_path, 'r') as version_file:
            version = version_file.read().strip()

        socketio.emit('terminal_output', 
                     {'data': f'Read version: {version} from version.txt'}, 
                     namespace='/data-package')
        return version
    def list_cert_files(self, container_name):
        """
        Lists certificate files in the specified container's /opt/tak/certs/files directory.
        Returns list of filenames.
        """
        self.check_stop()
        try:
            socketio.emit('terminal_output', 
                     {'data': f'Listing certificate files from container {container_name}...'}, 
                     namespace='/data-package')

            # First check if the directory exists
            check_dir_command = [
                'docker', 'exec', container_name,
                'sh', '-c', 'test -d /opt/tak/certs/files && echo "exists"'
            ]
            self.run_command.emit_log_output(f"Executing command: {' '.join(check_dir_command)}", 'data-package')
            try:
                result = self.run_command.run_command(check_dir_command, 
                                                namespace='data-package',
                                                capture_output=True)
                # Handle both string and bytes output
                output = result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout
                if 'exists' not in output:
                    raise Exception("Certificate directory not found in container")
            except Exception as e:
                raise Exception(f"Error checking certificate directory: {str(e)}")

            # List the files
            list_files_command = [
                'docker', 'exec', container_name,
                'sh', '-c', 'find /opt/tak/certs/files -type f -name "*.p12" -o -name "*.pem" -o -name "*.jks" | xargs -n1 basename'
            ]
            self.run_command.emit_log_output(f"Executing command: {' '.join(list_files_command)}", 'data-package')
            result = self.run_command.run_command(list_files_command, 
                                            namespace='data-package',
                                            capture_output=True)
            
            # Handle both string and bytes output
            output = result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout
            
            if output:
                # Split the output into lines and filter empty lines
                cert_files = [line.strip() for line in output.split('\n') if line.strip()]
                
                socketio.emit('terminal_output', 
                            {'data': f'Found certificate files: {cert_files}'}, 
                            namespace='/data-package')
                return cert_files
            else:
                socketio.emit('terminal_output', 
                            {'data': 'No certificate files found'}, 
                            namespace='/data-package')
                return []

        except Exception as e:
            error_msg = f"Error listing certificate files: {str(e)}"
            socketio.emit('terminal_output', {'data': error_msg}, namespace='/data-package')
            raise Exception(error_msg)
        
    def get_certificate_files(self):
        """
        Main function that checks Docker and TAKServer status and returns certificate files.
        Returns list of certificate filenames.
        """
        try:
            # Get container name from status
            version = self.read_version_txt()
            container_name = f"takserver-{version}"
            
            # List certificate files from container
            return self.list_cert_files(container_name)
                
        except Exception as e:
            error_msg = f"Error getting certificate files: {str(e)}"
            socketio.emit('terminal_output', {'data': error_msg}, namespace='/data-package')
            return []  # Return empty list on any error

    def create_zip_file(self, temp_dir, zip_name):
        """
        Creates a clean zip file for ATAK data package from the temporary directory.
        """
        self.check_stop()
        working_dir = self.get_default_working_directory()
        
        # Ensure clean zip_name
        zip_name = zip_name.replace(' ', '_')
        if zip_name.lower().endswith('.zip'):
            zip_name = zip_name[:-4]
        
        zip_path = os.path.join(working_dir, f"{zip_name}.zip")
        
        # Remove existing zip if it exists
        if os.path.exists(zip_path):
            os.remove(zip_path)
        
        socketio.emit('terminal_output', 
                     {'data': f'Creating data package: {zip_path}'}, 
                     namespace='/data-package')
        
        try:
            # Create zip with clean structure
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, _, files in os.walk(temp_dir):
                    for file in files:
                        # Skip any system files
                        if file.startswith('.') or file.startswith('._'):
                            continue
                            
                        file_path = os.path.join(root, file)
                        arc_name = os.path.relpath(file_path, temp_dir).replace(os.sep, '/')
                        zipf.write(file_path, arc_name)

            socketio.emit('terminal_output', 
                         {'data': 'Data package created successfully'}, 
                         namespace='/data-package')
                         
        except Exception as e:
            error_msg = f'Error creating data package: {str(e)}'
            socketio.emit('terminal_output', 
                         {'data': error_msg}, 
                         namespace='/data-package')
            raise

    def main(self, preferences_data):
        try:
            # Create a temporary directory for all operations
            with tempfile.TemporaryDirectory() as temp_dir:
                # Emit installation started event
                socketio.emit('installation_started', namespace='/data-package')
                socketio.emit('terminal_output', {'data': 'Starting data package configuration...'}, namespace='/data-package')

                # Get file names from preferences, without default values
                zip_name = preferences_data.get('#zip_file_name', 'data_package')
                ca_cert_name = preferences_data.get('#ca_cert_name')  # Remove default
                client_cert_name = preferences_data.get('#client_cert_name')  # Remove default
                
                # Remove special markers from preferences
                preferences_data = {k: v for k, v in preferences_data.items() if not k.startswith('#')}

                # Generate config file in temp directory
                self.generate_config_pref(preferences_data, temp_dir)
                
                # Create manifest file in temp directory
                self.create_manifest_file(temp_dir, zip_name, ca_cert_name, client_cert_name)
                
                # Only copy certificates if they are actually present in preferences
                if ca_cert_name or client_cert_name:
                    self.copy_certificates_from_container(temp_dir, ca_cert_name, client_cert_name)
                
                # Create final zip file from temp directory
                self.create_zip_file(temp_dir, zip_name)
                
                socketio.emit('terminal_output', {'data': 'Data package configuration completed successfully'}, namespace='/data-package')
                socketio.emit('installation_complete', namespace='/data-package')
                
        except Exception as e:
            error_msg = f'Error during configuration: {str(e)}'
            socketio.emit('terminal_output', {'data': error_msg}, namespace='/data-package')
            socketio.emit('installation_failed', {'error': error_msg}, namespace='/data-package')
            raise