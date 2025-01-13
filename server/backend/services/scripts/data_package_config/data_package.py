import xml.etree.ElementTree as ET
import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import json
import logging
import shutil
from xml.dom import minidom
import zipfile
import tempfile
import uuid
import time
import asyncio

logger = logging.getLogger(__name__)

class DataPackage:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.stop_event = False
        self.emit_event = emit_event

    def stop(self):
        """Stop the current configuration process"""
        self.stop_event = True
        self._create_event(
            'stop',
            'stopped',
            'Configuration stopped by user',
            {'isInProgress': False}
        )

    def check_stop(self):
        """Check if the operation should be stopped"""
        if self.stop_event:
            raise Exception("Configuration stopped by user")

    def _create_event(self, operation_type: str, status: str, message: str, details: dict = None) -> Dict[str, Any]:
        """Create an event object for SSE"""
        event_data = {
            'status': status,
            'operation': operation_type,
            'message': message,
            'details': details or {},
            'timestamp': time.time()
        }
        logger.debug(f"Created operation status event: {event_data}")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data

    def _create_files_event(self, files: list) -> Dict[str, Any]:
        """Create a files update event"""
        event_data = {
            'status': 'update',
            'type': 'files_update',
            'files': files,
            'timestamp': time.time()
        }
        logger.debug(f"Created files update event")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data

    async def status_generator(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate data package status events."""
        while True:
            try:
                files = self.get_certificate_files()
                event_data = {
                    'type': 'data_package_status',
                    'files': files,
                    'timestamp': time.time()
                }
                yield {
                    "event": "data_package_status",
                    "data": json.dumps(event_data)
                }
            except Exception as e:
                logger.error(f"Error generating data package status: {str(e)}")
                yield {
                    "event": "data_package_status",
                    "data": json.dumps({
                        'type': 'error',
                        'message': f'Error getting data package status: {str(e)}',
                        'files': [],
                        'timestamp': time.time()
                    })
                }
            await asyncio.sleep(5)  # Update every 5 seconds

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
        
        self._create_event(
            'config',
            'in_progress',
            f'Creating config file at: {config_pref_path}',
            {'isInProgress': True}
        )
        
        with open(config_pref_path, 'w', encoding='utf-8') as file:
            file.write(xml_content)
            
        self._create_event(
            'config',
            'in_progress',
            'Config file created successfully',
            {'isInProgress': True}
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

    def list_cert_files(self, container_name) -> list:
        """Lists certificate files in the specified container's /opt/tak/certs/files directory."""
        self.check_stop()
        try:
            self._create_event(
                'files',
                'in_progress',
                f'Listing certificate files from container {container_name}...',
                {'isInProgress': True}
            )

            # First check if the directory exists
            check_dir_command = [
                'docker', 'exec', container_name,
                'sh', '-c', 'test -d /opt/tak/certs/files && echo "exists"'
            ]
            self.run_command.emit_log_output(f"Executing command: {' '.join(check_dir_command)}", 'data-package')
            try:
                result = self.run_command.run_command(check_dir_command, channel='data-package', capture_output=True)
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
            
            output = result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout
            
            if output:
                cert_files = [line.strip() for line in output.split('\n') if line.strip()]
                
                self._create_event(
                    'files',
                    'in_progress',
                    f'Found certificate files: {cert_files}',
                    {
                        'isInProgress': True,
                        'files': cert_files
                    }
                )
                return cert_files
            else:
                self._create_event(
                    'files',
                    'in_progress',
                    'No certificate files found',
                    {
                        'isInProgress': True,
                        'files': []
                    }
                )
                return []

        except Exception as e:
            error_msg = f"Error listing certificate files: {str(e)}"
            self._create_event(
                'files',
                'error',
                error_msg,
                {
                    'isInProgress': False,
                    'error': str(e)
                }
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
        
        self._create_event(
            'config',
            'in_progress',
            f'Creating data package: {zip_path}',
            {'isInProgress': True}
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

            self._create_event(
                'config',
                'in_progress',
                'Data package created successfully',
                {'isInProgress': True}
            )
                         
        except Exception as e:
            error_msg = f'Error creating data package: {str(e)}'
            self.run_command.emit_log_output(
                error_msg,
                'data-package'
            )
            self._create_event(
                'config',
                'error',
                error_msg,
                {
                    'isInProgress': False,
                    'error': str(e)
                }
            )
            raise

    def get_certificate_files(self) -> list:
        """Get certificate files from the container"""
        try:
            version = self.read_version_txt()
            container_name = f"takserver-{version}"
            cert_files = self.list_cert_files(container_name)
            
            # Create files update event
            self._create_files_event(cert_files)
            
            return cert_files

        except Exception as e:
            error_msg = f"Error getting certificate files: {str(e)}"
            self.run_command.emit_log_output(
                error_msg,
                'data-package'
            )
            self._create_event(
                'files',
                'error',
                error_msg,
                {
                    'error': str(e),
                    'files': []
                }
            )
            return []

    def main(self, preferences_data) -> Dict[str, Any]:
        """Main function to handle data package configuration"""
        try:
            self.stop_event = False
            
            # Create a temporary directory for all operations
            with tempfile.TemporaryDirectory() as temp_dir:
                # Emit operation started event
                self._create_event(
                    'config',
                    'started',
                    'Starting data package configuration...',
                    {'isInProgress': True}
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
                self.generate_config_pref(preferences_data, temp_dir)
                
                # Create manifest file in temp directory with all certificates
                self.create_manifest_file(temp_dir, zip_name, ca_certs, client_certs)
                
                # Copy all certificates if any are present
                if ca_certs or client_certs:
                    self.copy_certificates_from_container(temp_dir, ca_certs, client_certs)
                
                # Create final zip file from temp directory
                self.create_zip_file(temp_dir, zip_name)
                
                self._create_event(
                    'config',
                    'completed',
                    'Data package configuration completed successfully',
                    {'isInProgress': False}
                )
                
                return {'status': 'Data package configuration completed successfully'}

        except Exception as e:
            error_msg = f'Error during configuration: {str(e)}'
            self.run_command.emit_log_output(
                error_msg,
                'data-package'
            )
            self._create_event(
                'config',
                'error',
                error_msg,
                {
                    'isInProgress': False,
                    'error': str(e)
                }
            )
            return {'error': error_msg}