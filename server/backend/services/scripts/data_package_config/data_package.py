import xml.etree.ElementTree as ET
import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import json
import logging
from xml.dom import minidom
import zipfile
import tempfile
import uuid
import time
import asyncio
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class DataPackage:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.stop_event = False
        self.emit_event = emit_event
        self._last_status = None
        self._progress = 0
        self._last_cert_list = None
        self.working_dir = self.get_default_working_directory()

    def stop(self):
        """Stop the current configuration process"""
        self.stop_event = True
        self.update_status("stopped", 100, "Configuration stopped by user")

    def check_stop(self):
        """Check if the operation should be stopped"""
        if self.stop_event:
            raise Exception("Configuration stopped by user")

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None) -> None:
        """Update configuration status."""
        if self.emit_event:
            new_status = {
                "type": "status",
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            }
            
            # Only emit if status has changed
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status
                self._progress = progress

    async def read_version_txt(self):
        """Get TAK Server version from version.txt."""
        version_file_path = os.path.join(self.working_dir, "version.txt")

        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    return version if version else None
            except Exception:
                return None
        return None

    async def list_cert_files(self, container_name) -> list:
        """Lists certificate files in the specified container's /opt/tak/certs/files directory."""
        try:
            logger.debug(f"Listing certificate files in container {container_name}")
            list_files_command = [
                'docker', 'exec', container_name,
                'ls', '/opt/tak/certs/files'
            ]
            
            result = await self.run_command.run_command_async(
                list_files_command,
                'data-package',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if result.success and result.stdout:
                cert_files = result.stdout.splitlines()
                logger.debug(f"Found certificate files: {cert_files}")
                return cert_files
            
            logger.debug("No certificate files found")
            return []

        except Exception as e:
            logger.error(f"Error listing certificate files: {str(e)}")
            return []

    async def certificate_monitor(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate certificate list update events."""
        while True:
            try:
                version = await self.read_version_txt()
                if version:
                    container_name = f"takserver-{version}"
                    cert_files = await self.list_cert_files(container_name)
                    
                    # Only emit if the certificate list has changed
                    cert_list = sorted(cert_files) if cert_files else []
                    if cert_list != self._last_cert_list:
                        self._last_cert_list = cert_list
                        event_data = {
                            'type': 'certificate_list',
                            'certificates': cert_list,
                            'timestamp': time.time()
                        }
                        yield {
                            "event": "certificate_list",
                            "data": json.dumps(event_data)
                        }
                else:
                    # Reset last cert list if server is not running
                    if self._last_cert_list is not None:
                        self._last_cert_list = None
                        yield {
                            "event": "certificate_list",
                            "data": json.dumps({
                                'type': 'certificate_list',
                                'certificates': [],
                                'timestamp': time.time()
                            })
                        }
            except Exception as e:
                logger.error(f"Error monitoring certificates: {str(e)}")
                if self._last_cert_list is not None:
                    self._last_cert_list = None
                    yield {
                        "event": "certificate_list",
                        "data": json.dumps({
                            'type': 'certificate_list',
                            'certificates': [],
                            'timestamp': time.time()
                        })
                    }
            await asyncio.sleep(2)  # Check every 2 seconds

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    async def copy_certificates_from_container(self, temp_dir, ca_certs, client_certs, channel: str = 'data-package'):
        """
        Copies the specified certificates from the container to the temporary directory.
        Only copies certificates if valid names are provided.
        """
        self.check_stop()
        version = await self.read_version_txt()
        container_name = f"takserver-{version}"

        # Create cert directory in temp directory
        cert_dir = os.path.join(temp_dir, 'cert')
        os.makedirs(cert_dir, exist_ok=True)

        # Only copy certificates if valid names are provided
        if ca_certs:
            for ca_cert in ca_certs:
                await self.update_status(
                    "in_progress",
                    self._progress,
                    f"Copying CA certificate: {ca_cert}"
                )
                ca_cert_src = f"/opt/tak/certs/files/{ca_cert}"
                ca_cert_dest = os.path.join(cert_dir, ca_cert)
                copy_ca_cert_command = [
                    'docker', 'cp', f"{container_name}:{ca_cert_src}", ca_cert_dest
                ]
                result = await self.run_command.run_command_async(
                    copy_ca_cert_command, 
                    'data-package',
                    emit_event=self.emit_event
                )
                if not result.success:
                    raise Exception(f"Failed to copy CA certificate {ca_cert}: {result.stderr}")

        if client_certs:
            for client_cert in client_certs:
                await self.update_status(
                    "in_progress",
                    self._progress,
                    f"Copying client certificate: {client_cert}"
                )
                client_cert_src = f"/opt/tak/certs/files/{client_cert}"
                client_cert_dest = os.path.join(cert_dir, client_cert)
                copy_client_cert_command = [
                    'docker', 'cp', f"{container_name}:{client_cert_src}", client_cert_dest
                ]
                result = await self.run_command.run_command_async(
                    copy_client_cert_command, 
                    'data-package',
                    emit_event=self.emit_event
                )
                if not result.success:
                    raise Exception(f"Failed to copy client certificate {client_cert}: {result.stderr}")

        await self.update_status(
            "in_progress",
            self._progress,
            f"Copied all certificates to {cert_dir}"
        )

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
        with open(config_pref_path, 'w', encoding='utf-8') as file:
            file.write(xml_content)

    def create_manifest_file(self, temp_dir, zip_name, ca_certs, client_certs, channel: str = 'data-package'):
        """
        Creates a clean manifest file in the temporary directory.
        Only includes certificate entries if valid certificate names are provided.
        """
        manifest_dir = os.path.join(temp_dir, 'MANIFEST')
        os.makedirs(manifest_dir, exist_ok=True)
        
        # Generate a random UUID
        package_uid = str(uuid.uuid4())
        
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

    async def create_zip_file(self, temp_dir, zip_name, channel: str = 'data-package'):
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

        await self.update_status(
            "in_progress",
            self._progress,
            f"Creating data package: {zip_path}"
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
                         
        except Exception as e:
            error_msg = f'Error creating data package: {str(e)}'
            await self.update_status(
                "error",
                self._progress,
                error_msg,
                str(e)
            )
            raise

    async def main(self, preferences_data) -> Dict[str, Any]:
        """Main function to handle data package configuration"""
        try:
            self.stop_event = False
            self._progress = 0
            
            # Define task weights and initial progress
            weights = {
                'setup': 10,
                'config': 30,
                'certificates': 30,
                'packaging': 30
            }
            
            # Create a temporary directory for all operations
            with tempfile.TemporaryDirectory() as temp_dir:
                # Initial setup
                await self.update_status("in_progress", self._progress, "Starting data package configuration...")
                
                # Get zip name from preferences
                zip_name = preferences_data.get('#zip_file_name', 'data_package')
                self._progress += weights['setup']
                await self.update_status("in_progress", self._progress, "Initialized configuration")
                
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

                # Generate config file
                self.generate_config_pref(preferences_data, temp_dir)
                self._progress += weights['config']
                await self.update_status("in_progress", self._progress, "Generated configuration file")
                
                # Create manifest and handle certificates
                self.create_manifest_file(temp_dir, zip_name, ca_certs, client_certs)
                if ca_certs or client_certs:
                    await self.copy_certificates_from_container(temp_dir, ca_certs, client_certs)
                self._progress += weights['certificates']
                await self.update_status("in_progress", self._progress, "Processed certificates")
                
                # Create final package
                await self.create_zip_file(temp_dir, zip_name)
                self._progress = 100
                await self.update_status("complete", self._progress, "Data package configuration completed successfully")
                
                return {'status': 'Data package configuration completed successfully'}

        except Exception as e:
            error_msg = f'Error during configuration: {str(e)}'
            await self.update_status("error", 100, "Configuration failed", str(e))
            return {'error': error_msg}