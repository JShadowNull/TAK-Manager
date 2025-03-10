import os
import uuid
import shutil
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class PackageCreator:
    def __init__(self, directory_helper):
        self.directory_helper = directory_helper
        
    def create_manifest_file(self, temp_dir, zip_name, ca_certs, client_certs, custom_files):
        """Updated manifest creation with custom files at root level"""
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
            
            # Then add all client certificates (if any)
            if client_certs:
                for client_cert in client_certs:
                    manifest_content += f'\n        <Content ignore="false" zipEntry="cert/{client_cert}"/>'
            
            # Add custom files at root level
            if custom_files:
                for custom_file in custom_files:
                    manifest_content += f'\n        <Content ignore="false" zipEntry="{os.path.basename(custom_file)}"/>'
            
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
            logger.error("Temporary directory: %s", temp_dir)  # Log temp directory for debugging
            logger.error("Zip name: %s", zip_name)  # Log zip name for debugging
            logger.error("CA certificates: %s", ca_certs)  # Log CA certificates for debugging
            logger.error("Client certificates: %s", client_certs)  # Log client certificates for debugging
            logger.error("Custom files: %s", custom_files)  # Log custom files for debugging
            raise Exception(f"Manifest file creation error: {str(e)}")
            
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
            logger.error("Temporary directory: %s", temp_dir)  # Log temp directory for debugging
            logger.error("Zip name: %s", zip_name)  # Log zip name for debugging
            raise Exception(f"Package creation error: {str(e)}") 