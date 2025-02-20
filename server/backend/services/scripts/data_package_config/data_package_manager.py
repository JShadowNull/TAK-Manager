import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Callable, Any
import shutil
import time
import asyncio
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper

logger = configure_logging(__name__)

class DataPackageManager:
    def __init__(self):
        self.directory_helper = DirectoryHelper()
        self.packages_dir = self.directory_helper.get_data_packages_directory()

    async def get_packages(self) -> List[Dict[str, str]]:
        """List all data packages with their metadata."""
        try:
            packages = []
            for filename in os.listdir(self.packages_dir):
                if not filename.endswith('.zip'):
                    continue
                
                file_path = os.path.join(self.packages_dir, filename)
                stat = os.stat(file_path)
                
                size_bytes = stat.st_size
                for unit in ['B', 'KB', 'MB', 'GB']:
                    if size_bytes < 1024:
                        size = f"{size_bytes:.2f} {unit}"
                        break
                    size_bytes /= 1024
                
                packages.append({
                    'fileName': filename,
                    'createdAt': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'size': size
                })
            
            return sorted(packages, key=lambda x: x['createdAt'], reverse=True)

        except Exception as e:
            logger.error(f"Failed to list packages: {str(e)}")
            raise

    def get_package_path(self, filename: str) -> str:
        """Validate and return full package path."""
        if not filename.endswith('.zip'):
            raise ValueError("Invalid package file extension")
            
        file_path = os.path.join(self.packages_dir, filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Package {filename} not found")
            
        return file_path

    async def delete_package(self, filename: str) -> None:
        """Delete a single package file."""
        try:
            file_path = self.get_package_path(filename)
            os.remove(file_path)
            
            if os.path.exists(file_path):
                raise RuntimeError(f"Failed to delete {filename}")

        except Exception as e:
            logger.error(f"Package deletion failed: {str(e)}")
            raise

    async def delete_batch(self, filenames: List[str]) -> None:
        """Delete multiple packages in batch."""
        try:
            for filename in filenames:
                await self.delete_package(filename)
        except Exception as e:
            logger.error(f"Batch delete failed: {str(e)}")
            raise

    async def download_batch(self, filenames: List[str]) -> List[str]:
        """Validate multiple packages for download."""
        try:
            return [self.get_package_path(f) for f in filenames]
        except Exception as e:
            logger.error(f"Download validation failed: {str(e)}")
            raise 