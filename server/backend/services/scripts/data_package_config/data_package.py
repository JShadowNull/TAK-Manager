import xml.etree.ElementTree as ET
import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from flask_sse import sse
import logging
import shutil
from xml.dom import minidom
import zipfile
import tempfile
import uuid
import time

logger = logging.getLogger(__name__)

class DataPackage:
    def __init__(self):
        self.run_command = RunCommand()
        self.stop_event = False

    def stop(self):
        """Stop the current configuration process"""
        self.stop_event = True
        sse.publish(
            {
                'status': 'stopped',
                'message': 'Configuration stopped by user',
                'isInProgress': False,
                'timestamp': time.time()
            },
            type='data_package_status'
        )

    def check_stop(self):
        """Check if the operation should be stopped"""
        if self.stop_event:
            raise Exception("Configuration stopped by user")

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def generate_config_pref(self, preferences_data, temp_dir, channel: str = 'data-package'):
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
        
        sse.publish(
            {
                'status': 'in_progress',
                'message': f'Creating config file at: {config_pref_path}',
                'isInProgress': True,
                'timestamp': time.time()
            },
            type='data_package_status'
        )
        
        with open(config_pref_path, 'w', encoding='utf-8') as file:
            file.write(xml_content)
            
        sse.publish(
            {
                'status': 'in_progress',
                'message': 'Config file created successfully',
                'isInProgress': True,
                'timestamp': time.time()
            },
            type='data_package_status'
        )

    def generate_uuid(self):
        """
        Generates a random UUID for the manifest file.
        """
        return str(uuid.uuid4())

    def create_manifest_file(self, temp_dir, zip_name, ca_certs, client_certs, channel: str = 'data-package'):
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
        if ca_certs:
            for ca_cert in ca_certs:
                manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{ca_cert}"/>'
        if client_certs:
            for client_cert in client_certs:
                manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{client_cert}"/>'
        
        # Always add the initial.pref entry
        manifest_content += f'\n        <Content ignore="false" zipEntry="initial.pref"/>'
        
        # Close the manifest content
        manifest_content += "\n    </Contents>\n</MissionPackageManifest>"

        manifest_path = os.path.join(manifest_dir, 'manifest.xml')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(manifest_content)
        
        self.run_command.emit_log_output(f'Manifest file created at: {manifest_path}', channel='data-package')

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

    def copy_certificates_from_container(self, temp_dir, ca_certs, client_certs, channel: str = 'data-package'):
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
        if ca_certs:
            for ca_cert in ca_certs:
                ca_cert_src = f"/opt/tak/certs/files/{ca_cert}"
                ca_cert_dest = os.path.join(cert_dir, ca_cert)
                copy_ca_cert_command = [
                    'docker', 'cp', f"{container_name}:{ca_cert_src}", ca_cert_dest
                ]
                self.run_command.run_command(copy_ca_cert_command, channel='data-package')

        if client_certs:
            for client_cert in client_certs:
                client_cert_src = f"/opt/tak/certs/files/{client_cert}"
                client_cert_dest = os.path.join(cert_dir, client_cert)
                copy_client_cert_command = [
                    'docker', 'cp', f"{container_name}:{client_cert_src}", client_cert_dest
                ]
                self.run_command.run_command(copy_client_cert_command, channel='data-package')

        self.run_command.emit_log_output(f'Copied certificates to {cert_dir}', channel='data-package')

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

        self.run_command.emit_log_output(
            f'Read version: {version} from version.txt',
            channel='data-package'
        )
        return version

    def list_cert_files(self, container_name):
        """
        Lists certificate files in the specified container's /opt/tak/certs/files directory.
        Returns list of filenames.
        """
        self.check_stop()
        try:
            sse.publish(
                {
                    'status': 'in_progress',
                    'message': f'Listing certificate files from container {container_name}...',
                    'isInProgress': True,
                    'timestamp': time.time()
                },
                type='data_package_status'
            )

            # First check if the directory exists
            check_dir_command = [
                'docker', 'exec', container_name,
                'sh', '-c', 'test -d /opt/tak/certs/files && echo "exists"'
            ]
            self.run_command.emit_log_output(f"Executing command: {' '.join(check_dir_command)}", 'data-package')
            try:
                result = self.run_command.run_command(check_dir_command, channel='data-package', capture_output=True)
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
            result = self.run_command.run_command(list_files_command, channel='data-package', capture_output=True)
            
            # Handle both string and bytes output
            output = result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout
            
            if output:
                # Split the output into lines and filter empty lines
                cert_files = [line.strip() for line in output.split('\n') if line.strip()]
                
                sse.publish(
                    {
                        'status': 'in_progress',
                        'message': f'Found certificate files: {cert_files}',
                        'isInProgress': True,
                        'timestamp': time.time(),
                        'files': cert_files
                    },
                    type='data_package_status'
                )
                return cert_files
            else:
                sse.publish(
                    {
                        'status': 'in_progress',
                        'message': 'No certificate files found',
                        'isInProgress': True,
                        'timestamp': time.time(),
                        'files': []
                    },
                    type='data_package_status'
                )
                return []

        except Exception as e:
            error_msg = f"Error listing certificate files: {str(e)}"
            sse.publish(
                {
                    'status': 'error',
                    'message': error_msg,
                    'isInProgress': False,
                    'timestamp': time.time(),
                    'error': str(e)
                },
                type='data_package_status'
            )
            raise Exception(error_msg)

    def create_zip_file(self, temp_dir, zip_name, channel: str = 'data-package'):
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
        
        sse.publish(
            {
                'status': 'in_progress',
                'message': f'Creating data package: {zip_path}',
                'isInProgress': True,
                'timestamp': time.time()
            },
            type='data_package_status'
        )
        
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

            sse.publish(
                {
                    'status': 'in_progress',
                    'message': 'Data package created successfully',
                    'isInProgress': True,
                    'timestamp': time.time()
                },
                type='data_package_status'
            )
                         
        except Exception as e:
            error_msg = f'Error creating data package: {str(e)}'
            sse.publish(
                {
                    'status': 'error',
                    'message': error_msg,
                    'isInProgress': False,
                    'timestamp': time.time(),
                    'error': str(e)
                },
                type='data_package_status'
            )
            raise

    def get_certificate_files(self, channel: str = 'data-package'):
        """Get certificate files from the container"""
        try:
            version = self.read_version_txt()
            container_name = f"takserver-{version}"
            cert_files = self.list_cert_files(container_name)
            
            # Emit the certificate files for the frontend
            sse.publish(
                {
                    'event': 'certificate_files',
                    'data': {
                        'files': cert_files
                    },
                    'type': 'data_package_status'
                }
            )
            
            return cert_files

        except Exception as e:
            error_msg = f"Error getting certificate files: {str(e)}"
            self.run_command.emit_log_output(
                f'Error getting certificate files: {str(e)}',
                channel='data-package'
            )
            sse.publish(
                {
                    'status': 'error',
                    'message': error_msg,
                    'isInProgress': False,
                    'timestamp': time.time(),
                    'error': str(e)
                },
                type='data_package_status'
            )
            sse.publish(
                {
                    'event': 'certificate_files',
                    'data': {
                        'files': []
                    },
                    'type': 'data_package_status'
                }
            )
            return []

    def main(self, preferences_data, channel: str = 'data-package'):
        """Main function to handle data package configuration"""
        try:
            self.stop_event = False
            
            # Create a temporary directory for all operations
            with tempfile.TemporaryDirectory() as temp_dir:
                # Emit operation started event
                sse.publish(
                    {
                        'status': 'started',
                        'message': 'Starting data package configuration...',
                        'isInProgress': True,
                        'timestamp': time.time()
                    },
                    type='data_package_status'
                )

                # Get zip name from preferences
                zip_name = preferences_data.get('#zip_file_name', 'data_package')
                
                # Extract certificate names for all streams
                stream_count = int(preferences_data.get('count', 1))
                ca_certs = []
                client_certs = []
                
                for i in range(stream_count):
                    ca_cert = preferences_data.get(f'#ca_cert_name{i}')
                    client_cert = preferences_data.get(f'#client_cert_name{i}')
                    if ca_cert:
                        ca_certs.append(ca_cert)
                    if client_cert:
                        client_certs.append(client_cert)
                
                # Remove special markers from preferences
                preferences_data = {k: v for k, v in preferences_data.items() if not k.startswith('#')}

                # Generate config file in temp directory
                self.generate_config_pref(preferences_data, temp_dir, channel)
                
                # Create manifest file in temp directory with all certificates
                self.create_manifest_file(temp_dir, zip_name, ca_certs, client_certs, channel)
                
                # Copy all certificates if any are present
                if ca_certs or client_certs:
                    self.copy_certificates_from_container(temp_dir, ca_certs, client_certs, channel)
                
                # Create final zip file from temp directory
                self.create_zip_file(temp_dir, zip_name, channel)
                
                sse.publish(
                    {
                        'status': 'completed',
                        'message': 'Data package configuration completed successfully',
                        'isInProgress': False,
                        'timestamp': time.time()
                    },
                    type='data_package_status'
                )
                
                return {'status': 'Data package configuration completed successfully'}

        except Exception as e:
            error_msg = f'Error during configuration: {str(e)}'
            self.run_command.emit_log_output(
                f'Error during configuration: {str(e)}',
                channel='data-package'
            )
            sse.publish(
                {
                    'status': 'error',
                    'message': error_msg,
                    'isInProgress': False,
                    'timestamp': time.time(),
                    'error': str(e)
                },
                type='data_package_status'
            )
            return {'error': error_msg}