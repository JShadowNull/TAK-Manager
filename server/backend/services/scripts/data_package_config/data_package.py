import os
import tempfile
from typing import Dict, Any
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper
from backend.services.helpers.run_command import RunCommand
from fastapi import UploadFile

# Import modules
from .modules.preferences import PreferencesManager
from .modules.certificates import CertificateManager
from .modules.custom_files import CustomFilesManager
from .modules.package_creator import PackageCreator

logger = configure_logging(__name__)

class DataPackage:
    def __init__(self):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        
        # Initialize module managers
        self.preferences_manager = PreferencesManager()
        self.certificate_manager = CertificateManager(self.directory_helper)
        self.custom_files_manager = CustomFilesManager(self.directory_helper)
        self.package_creator = PackageCreator(self.directory_helper)

    async def main(self, preferences_data) -> Dict[str, Any]:
        """Main method for data package creation"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_name = preferences_data.get('#zip_file_name', 'data_package')
                custom_files = preferences_data.get('customFiles', [])
                logger.debug(f"[main] Processing custom files: {custom_files}")
                
                # Extract certificate names
                stream_count = int(preferences_data.get('count', 1))
                ca_certs, client_certs = self.preferences_manager.extract_certificates(preferences_data, stream_count)
                
                # Generate configuration (without custom files in preferences)
                clean_preferences = self.preferences_manager.clean_preferences_data(preferences_data)
                if 'customFiles' in clean_preferences:
                    logger.debug("[main] Removing customFiles from preferences")
                    del clean_preferences['customFiles']  # Remove custom files from preferences
                self.preferences_manager.generate_config_pref(clean_preferences, temp_dir)
                
                # Create manifest with custom files
                manifest_path = self.package_creator.create_manifest_file(temp_dir, zip_name, ca_certs, client_certs, custom_files)
                logger.debug(f"[main] Created manifest at: {manifest_path}")
                
                # Copy certificates if needed
                if ca_certs or client_certs:
                    await self.certificate_manager.copy_certificates_from_container(temp_dir, ca_certs, client_certs)
                
                # Copy custom files to root of temp directory
                await self.custom_files_manager.copy_custom_files(temp_dir, custom_files)
                
                # Log directory contents before zipping
                logger.debug(f"[main] Temp directory contents: {os.listdir(temp_dir)}")
                
                zip_path = await self.package_creator.create_zip_file(temp_dir, zip_name)
                return {'status': 'success', 'path': zip_path}

        except Exception as e:
            logger.error(f"[main] Data package creation failed: {str(e)}")
            logger.error("Preferences data: %s", preferences_data)  # Log preferences data for debugging
            return {'error': str(e)}

    # Maintain the public API by exposing methods from managers
    
    # Certificate methods
    async def list_cert_files(self) -> list:
        return await self.certificate_manager.list_cert_files()
    
    # Custom files methods
    def get_custom_files_directory(self):
        return self.custom_files_manager.get_custom_files_directory()
        
    async def list_custom_files(self) -> list:
        return await self.custom_files_manager.list_custom_files()
        
    async def list_custom_files_with_metadata(self) -> list:
        return await self.custom_files_manager.list_custom_files_with_metadata()
        
    async def save_custom_file(self, file: UploadFile):
        return await self.custom_files_manager.save_custom_file(file)
        
    async def delete_custom_file(self, filename: str):
        return await self.custom_files_manager.delete_custom_file(filename) 