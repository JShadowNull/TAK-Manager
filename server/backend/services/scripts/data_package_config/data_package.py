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
from backend.services.helpers.directories import DirectoryHelper

logger = configure_logging(__name__)

class DataPackage:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.stop_event = False
        self.emit_event = emit_event
        self._last_status = None
        self._progress = 0
        self._last_cert_list = None
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()

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

    async def list_cert_files(self) -> list:
        """Lists certificate files in the /opt/tak/certs/files directory on the host."""
        try:
            logger.debug("Listing certificate files on the host")
            certs_directory = self.directory_helper.get_cert_directory()
            list_files_command = ['ls', certs_directory]
            
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

    async def copy_certificates_from_container(self, temp_dir, ca_certs, client_certs, channel: str = 'data-package'):
        """
        Copies the specified certificates from the container to the temporary directory.
        Only copies certificates if valid names are provided.
        """
        self.check_stop()
        version = await self.directory_helper.get_takserver_version()
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
        
        # Process each stream's configuration
        for i in range(stream_count):
            # Get stream details with proper error handling
            description = preferences_data.get(f'description{i}', '')
            ip_address = preferences_data.get(f'ipAddress{i}', '')
            port = preferences_data.get(f'port{i}', '')
            protocol = preferences_data.get(f'protocol{i}', '')
            ca_location = preferences_data.get(f'caLocation{i}', '')
            cert_location = preferences_data.get(f'certificateLocation{i}', '')
            client_password = preferences_data.get(f'clientPassword{i}', '')
            ca_password = preferences_data.get(f'caPassword{i}', client_password)  # Use client password as CA password if not specified

            # Log the stream configuration for debugging
            logger.debug(f"Processing stream {i} configuration:")
            logger.debug(f"Description: {description}")
            logger.debug(f"IP Address: {ip_address}")
            logger.debug(f"Port: {port}")
            logger.debug(f"Protocol: {protocol}")
            logger.debug(f"CA Location: {ca_location}")
            logger.debug(f"Client Password: {'*' * len(client_password) if client_password else 'None'}")

            # Add description entry
            desc_entry = ET.SubElement(cot_streams, 'entry')
            desc_entry.set('key', f'description{i}')
            desc_entry.set('class', 'class java.lang.String')
            desc_entry.text = description

            # Add enabled entry (always true for configured streams)
            enabled_entry = ET.SubElement(cot_streams, 'entry')
            enabled_entry.set('key', f'enabled{i}')
            enabled_entry.set('class', 'class java.lang.Boolean')
            enabled_entry.text = 'true'

            # Only add connect string if we have all required parts
            if ip_address and port and protocol:
                connect_string = f"{ip_address}:{port}:{protocol}"
                connect_entry = ET.SubElement(cot_streams, 'entry')
                connect_entry.set('key', f'connectString{i}')
                connect_entry.set('class', 'class java.lang.String')
                connect_entry.text = connect_string

            # Add certificate entries if they exist
            if ca_location:
                ca_entry = ET.SubElement(cot_streams, 'entry')
                ca_entry.set('key', f'caLocation{i}')
                ca_entry.set('class', 'class java.lang.String')
                ca_entry.text = ca_location

            if cert_location:
                cert_entry = ET.SubElement(cot_streams, 'entry')
                cert_entry.set('key', f'certificateLocation{i}')
                cert_entry.set('class', 'class java.lang.String')
                cert_entry.text = cert_location

            # Add password entries if they exist
            if client_password:
                client_pass_entry = ET.SubElement(cot_streams, 'entry')
                client_pass_entry.set('key', f'clientPassword{i}')
                client_pass_entry.set('class', 'class java.lang.String')
                client_pass_entry.text = client_password

            if ca_password:
                ca_pass_entry = ET.SubElement(cot_streams, 'entry')
                ca_pass_entry.set('key', f'caPassword{i}')
                ca_pass_entry.set('class', 'class java.lang.String')
                ca_pass_entry.text = ca_password

        # Create the main preferences section for ATAK settings
        main_pref = ET.SubElement(preferences, 'preference')
        main_pref.set('name', 'com.atakmap.app.civ_preferences')
        main_pref.set('version', '1')
        
        # Process ATAK preferences as direct entries
        for key, value in preferences_data.items():
            # Skip CoT stream related keys and special keys
            if (any(key.startswith(prefix) for prefix in ['description', 'ipAddress', 'port', 'protocol', 
                'caLocation', 'certificateLocation', 'clientPassword', 'caPassword', 'certPassword', 'count']) or 
                key.startswith('#')):
                continue

            # Add the preference entry
            entry = ET.SubElement(main_pref, 'entry')
            entry.set('key', key)
            
            # Determine the class type based on the value
            if isinstance(value, bool) or str(value).lower() in ('true', 'false'):
                entry.set('class', 'class java.lang.Boolean')
                entry.text = str(value).lower()
            elif str(value).isdigit():
                entry.set('class', 'class java.lang.Integer')
                entry.text = str(value)
            else:
                entry.set('class', 'class java.lang.String')
                entry.text = str(value)
        
        # Convert to string with proper formatting
        rough_string = ET.tostring(preferences, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        
        # Create custom XML declaration and format
        xml_content = '<?xml version="1.0" standalone="yes"?>\n'
        xml_content += '\n'.join([node.toprettyxml(indent="", newl="\n") for node in reparsed.childNodes if node.nodeType == node.ELEMENT_NODE])
        
        # Write to file
        config_pref_path = os.path.join(temp_dir, 'initial.pref')
        with open(config_pref_path, 'w', encoding='utf-8') as file:
            file.write(xml_content)
            
        # Log the generated XML for debugging
        logger.debug(f"Generated XML configuration:\n{xml_content}")

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
        
        # Add all CA certificates first
        if ca_certs:
            for ca_cert in ca_certs:
                manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{ca_cert}"/>'
        
        # Then add all client certificates
        if client_certs:
            for client_cert in client_certs:
                manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{client_cert}"/>'
        
        # Always add the initial.pref entry last
        manifest_content += f'\n        <Content ignore="false" zipEntry="initial.pref"/>'
        
        # Close the manifest content
        manifest_content += "\n    </Contents>\n</MissionPackageManifest>"

        manifest_path = os.path.join(manifest_dir, 'manifest.xml')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(manifest_content)
            
        # Log the generated manifest for debugging
        logger.debug(f"Generated manifest:\n{manifest_content}")

    async def create_zip_file(self, temp_dir, zip_name, channel: str = 'data-package'):
        """
        Creates a clean zip file for ATAK data package from the temporary directory.
        """
        self.check_stop()
        
        # Create datapackages subdirectory using DirectoryHelper
        packages_dir = self.directory_helper.get_data_packages_directory()
        
        # Ensure clean zip_name
        zip_name = zip_name.replace(' ', '_')
        if zip_name.lower().endswith('.zip'):
            zip_name = zip_name[:-4]
        
        zip_path = os.path.join(packages_dir, f"{zip_name}.zip")
        
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

                # Get the client cert from the main request
                main_client_cert = preferences_data.get('certificateLocation0', '').replace('cert/', '')
                if main_client_cert:
                    client_certs.append(main_client_cert)

                # Process certificates for each stream
                for i in range(stream_count):
                    # Get CA cert for this stream
                    ca_cert = preferences_data.get(f'caLocation{i}', '').replace('cert/', '')
                    if ca_cert and ca_cert not in ca_certs:
                        ca_certs.append(ca_cert)

                    # For stream 0, we already have the client cert
                    if i > 0:
                        client_cert = preferences_data.get(f'certificateLocation{i}', '').replace('cert/', '')
                        if client_cert and client_cert not in client_certs:
                            client_certs.append(client_cert)

                logger.debug(f"Certificates to process - CA: {ca_certs}, Client: {client_certs}")
                
                # Remove special markers from preferences but keep all stream data
                clean_preferences = {}
                for key, value in preferences_data.items():
                    if not key.startswith('#'):
                        if isinstance(value, dict):
                            if value.get('enabled', False) and 'value' in value:
                                clean_preferences[key] = value['value']
                        else:
                            clean_preferences[key] = value

                # Generate config file
                self.generate_config_pref(clean_preferences, temp_dir)
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