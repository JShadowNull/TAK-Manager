import xml.etree.ElementTree as ET
import os
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any
from xml.dom import minidom
import tempfile
import uuid
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper
import shutil

logger = configure_logging(__name__)

class DataPackage:
    def __init__(self):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()

    def generate_config_pref(self, preferences_data, temp_dir):
        """Generates the config.pref file in the temporary directory"""
        try:
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
            return config_pref_path
        except Exception as e:
            logger.error(f"Config generation failed: {str(e)}")
            raise Exception(f"Configuration file creation error: {str(e)}")

    def create_manifest_file(self, temp_dir, zip_name, ca_certs, client_certs):
        """Creates a clean manifest file in the temporary directory"""
        try:
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
            return manifest_path
        except Exception as e:
            logger.error(f"Manifest creation failed: {str(e)}")
            raise Exception(f"Manifest file creation error: {str(e)}")

    async def copy_certificates_from_container(self, temp_dir, ca_certs, client_certs):
        """Copies certificates from the container to the temporary directory"""
        try:
            container_name = f"takserver-{self.directory_helper.get_takserver_version()}"
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
                    result = await self.run_command.run_command_async(
                        command=copy_ca_cert_command,
                        event_type="data-package",
                    )
                    if not result.success:
                        raise Exception(f"Failed to copy CA certificate {ca_cert}: {result.stderr}")

            if client_certs:
                for client_cert in client_certs:
                    client_cert_src = f"/opt/tak/certs/files/{client_cert}"
                    client_cert_dest = os.path.join(cert_dir, client_cert)
                    copy_client_cert_command = [
                        'docker', 'cp', f"{container_name}:{client_cert_src}", client_cert_dest
                    ]
                    result = await self.run_command.run_command_async(
                        command=copy_client_cert_command,
                        event_type="data-package",
                    )
                    if not result.success:
                        raise Exception(f"Failed to copy client certificate {client_cert}: {result.stderr}")

            logger.debug(f"Copied all certificates to {cert_dir}")
        except Exception as e:
            logger.error(f"Certificate copy failed: {str(e)}")
            raise Exception(f"Certificate transfer error: {str(e)}")

    async def create_zip_file(self, temp_dir, zip_name):
        """Creates final zip package"""
        try:
            packages_dir = self.directory_helper.get_data_packages_directory()
            
            # Ensure clean zip_name
            zip_name = zip_name.replace(' ', '_')
            if zip_name.lower().endswith('.zip'):
                zip_name = zip_name[:-4]
            
            zip_path = os.path.join(packages_dir, f"{zip_name}.zip")
            
            # Remove existing zip if it exists
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # Create the zip file directly from the temp directory
            shutil.make_archive(base_name=os.path.join(packages_dir, zip_name),
                              format='zip',
                              root_dir=temp_dir)
            
            logger.debug(f"Successfully created zip package at: {zip_path}")
            return zip_path
        except Exception as e:
            logger.error(f"Zip creation failed: {str(e)}")
            raise Exception(f"Package creation error: {str(e)}")

    async def main(self, preferences_data) -> Dict[str, Any]:
        """Main configuration handler"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_name = preferences_data.get('#zip_file_name', 'data_package')
                
                # Extract certificate names
                stream_count = int(preferences_data.get('count', 1))
                ca_certs, client_certs = self._extract_certificates(preferences_data, stream_count)
                
                # Generate configuration
                clean_preferences = self._clean_preferences_data(preferences_data)
                self.generate_config_pref(clean_preferences, temp_dir)
                self.create_manifest_file(temp_dir, zip_name, ca_certs, client_certs)
                
                if ca_certs or client_certs:
                    await self.copy_certificates_from_container(temp_dir, ca_certs, client_certs)
                
                zip_path = await self.create_zip_file(temp_dir, zip_name)
                return {'status': 'success', 'path': zip_path}

        except Exception as e:
            logger.error(f"Data package creation failed: {str(e)}")
            return {'error': str(e)}

    def _extract_certificates(self, preferences_data, stream_count):
        """Extract certificate names from preferences data"""
        ca_certs = []
        client_certs = []

        main_client_cert = preferences_data.get('certificateLocation0', '').replace('cert/', '')
        if main_client_cert:
            client_certs.append(main_client_cert)

        for i in range(stream_count):
            ca_cert = preferences_data.get(f'caLocation{i}', '').replace('cert/', '')
            if ca_cert and ca_cert not in ca_certs:
                ca_certs.append(ca_cert)

            if i > 0:
                client_cert = preferences_data.get(f'certificateLocation{i}', '').replace('cert/', '')
                if client_cert and client_cert not in client_certs:
                    client_certs.append(client_cert)

        return ca_certs, client_certs

    def _clean_preferences_data(self, preferences_data):
        """Clean special markers from preferences data"""
        return {
            key: value['value'] if isinstance(value, dict) else value
            for key, value in preferences_data.items()
            if not key.startswith('#')
        }

    # ============================================================================
    # Certificate Listing
    # ============================================================================
    async def list_cert_files(self) -> list:
        """Lists certificate files in the /opt/tak/certs/files directory"""
        try:
            logger.debug("Listing certificate files in container")
            container_name = f"takserver-{self.directory_helper.get_takserver_version()}"
            
            # Execute command in container
            command = ["docker", "exec", container_name, "ls", "/opt/tak/certs/files"]
            result = await self.run_command.run_command_async(
                command=command,
                event_type="data-package",
            )
            
            if not result.success:
                raise Exception(f"Certificate listing failed: {result.stderr}")
            
            cert_files = result.stdout.splitlines()
            logger.debug(f"Found certificate files: {cert_files}")
            return [f for f in cert_files if f.endswith(('.p12', '.pem'))]

        except Exception as e:
            logger.error(f"Certificate listing error: {str(e)}")
            raise Exception(f"Failed to list certificates: {str(e)}")