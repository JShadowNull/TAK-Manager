import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Callable, Any
import shutil
import time
import asyncio
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class DataPackageManager:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.home_dir = '/home/tak-manager'
        self.packages_dir = os.path.join(self.home_dir, 'datapackages')
        os.makedirs(self.packages_dir, exist_ok=True)
        self.emit_event = emit_event
        self._last_status = None
        self._last_packages = None
        self._monitor_task = None

    async def start_monitoring(self):
        """Start monitoring packages for changes."""
        if self._monitor_task is None:
            self._monitor_task = asyncio.create_task(self._monitor_packages())

    async def stop_monitoring(self):
        """Stop monitoring packages."""
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None

    async def _monitor_packages(self):
        """Monitor packages for changes and emit events when changes are detected."""
        while True:
            try:
                packages = []
                for filename in os.listdir(self.packages_dir):
                    if filename.endswith('.zip'):
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
                
                packages.sort(key=lambda x: x['createdAt'], reverse=True)
                
                # Only emit if packages have changed
                if packages != self._last_packages:
                    self._last_packages = packages
                    if self.emit_event:
                        await self.emit_event({
                            "type": "packages_update",
                            "packages": packages,
                            "timestamp": int(time.time() * 1000)
                        })

            except Exception as e:
                if self.emit_event:
                    await self.emit_event({
                        "type": "status",
                        "operation": "monitor",
                        "status": "error",
                        "message": f"Error monitoring packages: {str(e)}",
                        "details": {"error": str(e)},
                        "isError": True,
                        "timestamp": int(time.time() * 1000)
                    })

            # Wait before next check
            await asyncio.sleep(2)  # Check every 2 seconds

    async def update_status(self, operation: str, status: str, message: str, details: Dict[str, Any] = None) -> None:
        """Update operation status."""
        if self.emit_event:
            new_status = {
                "type": "status",
                "operation": operation,
                "status": status,
                "message": message,
                "details": details or {},
                "isError": status == "error",
                "timestamp": int(time.time() * 1000)
            }
            
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status

    async def emit_packages_update(self, packages: list) -> None:
        """Emit packages update event."""
        if self.emit_event:
            await self.emit_event({
                "type": "packages_update",
                "packages": packages,
                "timestamp": int(time.time() * 1000)
            })

    async def get_packages(self) -> List[Dict[str, str]]:
        """List all data packages with their metadata."""
        try:
            await self.update_status(
                "fetch",
                "in_progress",
                "Fetching data packages"
            )

            packages = []
            for filename in os.listdir(self.packages_dir):
                if filename.endswith('.zip'):
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
            
            packages.sort(key=lambda x: x['createdAt'], reverse=True)
            
            if packages != self._last_packages:
                self._last_packages = packages
                await self.emit_packages_update(packages)

            await self.update_status(
                "fetch",
                "complete",
                "Successfully fetched data packages",
                {"total": len(packages)}
            )
            
            return packages
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error listing packages: {error_msg}")
            await self.update_status(
                "fetch",
                "error",
                f"Error fetching packages: {error_msg}",
                {"error": error_msg}
            )
            return []

    def get_package_path(self, filename: str) -> Optional[str]:
        """Get the full path of a package file if it exists."""
        file_path = os.path.join(self.packages_dir, filename)
        return file_path if os.path.exists(file_path) and filename.endswith('.zip') else None

    async def delete_package(self, filename: str) -> Dict[str, Any]:
        """Delete a package file."""
        try:
            await self.update_status(
                "delete_package",
                "in_progress",
                f"Deleting package {filename}",
                {"filename": filename}
            )

            file_path = self.get_package_path(filename)
            if not file_path:
                await self.update_status(
                    "delete_package",
                    "error",
                    f"Package {filename} not found",
                    {"filename": filename}
                )
                return {
                    'success': False,
                    'message': f'Package {filename} not found'
                }

            # Verify package exists before deletion
            packages = await self.get_packages()
            if not any(pkg['fileName'] == filename for pkg in packages):
                await self.update_status(
                    "delete_package",
                    "error",
                    f"Package {filename} not found",
                    {"filename": filename}
                )
                return {
                    'success': False,
                    'message': f'Package {filename} not found'
                }

            os.remove(file_path)
            
            # Verify deletion
            if os.path.exists(file_path):
                await self.update_status(
                    "delete_package",
                    "error",
                    f"Failed to delete package {filename}",
                    {"filename": filename}
                )
                return {
                    'success': False,
                    'message': f'Failed to delete package {filename}'
                }
            
            await self.update_status(
                "delete_package",
                "complete",
                f"Successfully deleted package {filename}",
                {"filename": filename}
            )
            
            return {
                'success': True,
                'message': f'Successfully deleted package {filename}'
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error deleting package {filename}: {error_msg}")
            await self.update_status(
                "delete_package",
                "error",
                f"Error deleting package {filename}",
                {
                    "filename": filename,
                    "error": error_msg
                }
            )
            return {
                'success': False,
                'message': f'Error deleting package {filename}: {error_msg}'
            }

    async def delete_batch(self, filenames: List[str]) -> Dict[str, Any]:
        """Delete multiple package files."""
        try:
            total = len(filenames)
            completed = 0
            results = []

            await self.update_status(
                "delete_package_batch",
                "in_progress",
                f"Starting batch deletion of {total} packages",
                {"total": total}
            )

            # Get initial packages list
            packages = await self.get_packages()
            
            for filename in filenames:
                try:
                    # Verify package exists
                    if not any(pkg['fileName'] == filename for pkg in packages):
                        results.append({
                            'filename': filename,
                            'message': f'Package {filename} not found',
                            'status': 'failed'
                        })
                        continue

                    # Update progress
                    await self.update_status(
                        "delete_package_batch",
                        "in_progress",
                        f"Deleting package {filename}",
                        {
                            "filename": filename,
                            "completed": completed,
                            "total": total
                        }
                    )

                    # Delete package
                    result = await self.delete_package(filename)
                    
                    if result['success']:
                        completed += 1
                        results.append({
                            'filename': filename,
                            'message': f'Successfully deleted package {filename}',
                            'status': 'completed'
                        })
                    else:
                        results.append({
                            'filename': filename,
                            'message': result['message'],
                            'status': 'failed'
                        })

                except Exception as e:
                    results.append({
                        'filename': filename,
                        'message': str(e),
                        'status': 'failed'
                    })

            # Send final status
            if completed == total:
                await self.update_status(
                    "delete_package_batch",
                    "complete",
                    f"Successfully deleted {completed} packages",
                    {
                        "total": total,
                        "completed": completed,
                        "results": results
                    }
                )
            else:
                await self.update_status(
                    "delete_package_batch",
                    "error",
                    f"Deleted {completed} of {total} packages",
                    {
                        "total": total,
                        "completed": completed,
                        "results": results
                    }
                )

            return {
                'success': completed == total,
                'message': f'Deleted {completed} of {total} packages',
                'results': results
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error in batch deletion: {error_msg}")
            await self.update_status(
                "delete_package_batch",
                "error",
                f"Error in batch deletion: {error_msg}",
                {"error": error_msg}
            )
            return {
                'success': False,
                'message': f'Error in batch deletion: {error_msg}',
                'results': []
            }

    async def download_batch(self, filenames: List[str]) -> Dict[str, Any]:
        """Download multiple packages in a batch."""
        try:
            total = len(filenames)
            completed = 0
            results = []

            await self.update_status(
                "download_batch",
                "in_progress",
                f"Starting batch download of {total} packages",
                {"total": total}
            )

            for filename in filenames:
                try:
                    await self.update_status(
                        "download",
                        "in_progress",
                        f"Downloading package {filename}",
                        {
                            "filename": filename,
                            "completed": completed,
                            "total": total
                        }
                    )

                    file_path = self.get_package_path(filename)
                    if not file_path:
                        results.append({
                            'filename': filename,
                            'message': 'Package not found',
                            'status': 'failed'
                        })
                        continue

                    completed += 1
                    results.append({
                        'filename': filename,
                        'message': 'Package downloaded successfully',
                        'status': 'completed',
                        'file_path': file_path
                    })

                    await self.update_status(
                        "download",
                        "complete",
                        f"Successfully downloaded package {filename}",
                        {
                            "filename": filename,
                            "file_path": file_path
                        }
                    )

                except Exception as e:
                    results.append({
                        'filename': filename,
                        'message': str(e),
                        'status': 'failed'
                    })

            if completed == total:
                await self.update_status(
                    "download_batch",
                    "complete",
                    f"Successfully downloaded {completed} packages",
                    {
                        "total": total,
                        "completed": completed,
                        "results": results
                    }
                )
            else:
                await self.update_status(
                    "download_batch",
                    "error",
                    f"Downloaded {completed} of {total} packages",
                    {
                        "total": total,
                        "completed": completed,
                        "results": results
                    }
                )

            return {
                'success': completed == total,
                'message': f'Downloaded {completed} of {total} packages',
                'results': results
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error in batch download: {error_msg}")
            await self.update_status(
                "download_batch",
                "error",
                f"Error in batch download: {error_msg}",
                {"error": error_msg}
            )
            return {
                'success': False,
                'message': f'Error in batch download: {error_msg}',
                'results': []
            } 