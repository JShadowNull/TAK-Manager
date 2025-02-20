# backend/routes/data_package_manager_routes.py

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List
from pydantic import BaseModel
from backend.services.scripts.data_package_config.data_package_manager import DataPackageManager
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

# Router setup
datapackage_manager = APIRouter()
package_manager = DataPackageManager()

# Pydantic models
class DeleteRequest(BaseModel):
    filenames: List[str]

@datapackage_manager.get('/list')
async def list_packages():
    """Get all available data packages"""
    try:
        packages = await package_manager.get_packages()
        return {
            'success': True,
            'packages': packages
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting packages: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage_manager.get('/download/{filename}')
async def download_package(filename: str):
    """Download a specific data package"""
    try:
        file_path = package_manager.get_package_path(filename)
        return FileResponse(
            file_path,
            filename=filename,
            media_type='application/zip'
        )
    except FileNotFoundError as e:
        logger.error(f"Package not found: {filename}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error downloading package {filename}: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@datapackage_manager.delete('/delete/{filename}')
async def delete_package(filename: str):
    """Delete a specific data package"""
    try:
        await package_manager.delete_package(filename)
        return {'success': True, 'message': f'Deleted {filename}'}
    except FileNotFoundError as e:
        logger.error(f"Delete failed - package not found: {filename}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting package {filename}: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage_manager.delete('/delete')
async def delete_packages(request: DeleteRequest):
    """Delete multiple data packages"""
    try:
        await package_manager.delete_batch(request.filenames)
        return {
            'success': True,
            'message': f'Deleted {len(request.filenames)} packages'
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting packages: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage_manager.post('/download')
async def download_packages(request: DeleteRequest):
    """Download multiple data packages"""
    try:
        file_paths = await package_manager.download_batch(request.filenames)
        return {
            'success': True,
            'file_paths': file_paths,
            'message': f'Ready to download {len(file_paths)} packages'
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error downloading packages: {error_message}")
        raise HTTPException(status_code=500, detail=error_message) 