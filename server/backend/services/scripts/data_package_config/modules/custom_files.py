import os
import shutil
import aiofiles
import mimetypes
import datetime
from fastapi import UploadFile
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class CustomFilesManager:
    def __init__(self, directory_helper):
        self.directory_helper = directory_helper
        
    def get_custom_files_directory(self):
        """Get the directory for storing custom files"""
        custom_dir = os.path.join(self.directory_helper.get_data_packages_directory(), 'customfiles')
        os.makedirs(custom_dir, exist_ok=True)
        return custom_dir

    async def copy_custom_files(self, temp_dir, custom_files):
        """Copy custom files to temp directory at root level"""
        try:
            logger.debug(f"[copy_custom_files] Starting to copy files: {custom_files}")
            custom_dir = self.get_custom_files_directory()
            logger.debug(f"[copy_custom_files] Custom files directory: {custom_dir}")
            
            for filename in custom_files:
                src = os.path.join(custom_dir, filename)
                dest = os.path.join(temp_dir, os.path.basename(filename))
                logger.debug(f"[copy_custom_files] Copying {src} -> {dest}")
                
                if os.path.exists(src):
                    shutil.copy2(src, dest)
                    logger.debug(f"[copy_custom_files] Successfully copied {filename}")
                else:
                    logger.warning(f"[copy_custom_files] File not found: {src}")
        except Exception as e:
            logger.error(f"[copy_custom_files] Failed to copy files: {str(e)}")
            logger.error("Temporary directory: %s", temp_dir)  # Log temp directory for debugging
            logger.error("Custom files: %s", custom_files)  # Log custom files for debugging
            raise

    async def list_custom_files(self) -> list:
        """List all uploaded custom files"""
        custom_dir = self.get_custom_files_directory()
        return [f for f in os.listdir(custom_dir) if os.path.isfile(os.path.join(custom_dir, f))]

    async def list_custom_files_with_metadata(self) -> list:
        """List all uploaded custom files with metadata"""
        custom_dir = self.get_custom_files_directory()
        files = []
        
        for filename in os.listdir(custom_dir):
            file_path = os.path.join(custom_dir, filename)
            if os.path.isfile(file_path):
                try:
                    stat = os.stat(file_path)
                    mime_type, _ = mimetypes.guess_type(filename)
                    
                    files.append({
                        'name': filename,
                        'size': stat.st_size,
                        'type': mime_type or 'application/octet-stream',
                        'lastModified': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
                except Exception as e:
                    logger.error(f"Error getting metadata for {filename}: {str(e)}")
                    continue
                
        return files

    async def save_custom_file(self, file: UploadFile):
        """Save an uploaded custom file"""
        custom_dir = self.get_custom_files_directory()
        file_path = os.path.join(custom_dir, file.filename)
        
        async with aiofiles.open(file_path, 'wb') as f:
            # Use larger chunks (8MB) for better performance with large files
            chunk_size = 8 * 1024 * 1024  # 8MB chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                await f.write(chunk)

    async def delete_custom_file(self, filename: str):
        """Delete a custom file from the server"""
        custom_dir = self.get_custom_files_directory()
        file_path = os.path.join(custom_dir, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
        else:
            logger.error(f"File {filename} not found for deletion")
            raise FileNotFoundError(f"File {filename} not found") 