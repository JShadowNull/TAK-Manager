# backend/routes/data_package_manager_routes.py

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Dict, Any, AsyncGenerator
from backend.services.scripts.data_package_config.data_package_manager import DataPackageManager
import json
import asyncio
from backend.config.logging_config import configure_logging
from pydantic import BaseModel

# Configure logger
logger = configure_logging(__name__)

# Router setup
datapackage_manager = APIRouter()

# Global state for SSE events
_latest_package_status: Dict[str, Any] = {}

# Initialize package manager
async def emit_event(data: Dict[str, Any]):
    """Update latest package status state"""
    global _latest_package_status
    if _latest_package_status != data:  # Only emit if data has changed
        _latest_package_status = data

package_manager = DataPackageManager(emit_event=emit_event)

# Start monitoring when the module loads
@datapackage_manager.on_event("startup")
async def startup_event():
    await package_manager.start_monitoring()

# Pydantic models
class DeleteRequest(BaseModel):
    filenames: List[str]

@datapackage_manager.get('/status-stream')
async def package_status_stream():
    """SSE endpoint for package status updates."""
    async def generate() -> AsyncGenerator[Dict[str, Any], None]:
        last_status = None
        while True:
            if _latest_package_status and _latest_package_status != last_status:
                event_data = {
                    "event": "package-status",
                    "data": json.dumps(_latest_package_status)
                }
                logger.debug(f"Sending package status SSE: {event_data}")
                last_status = _latest_package_status.copy()
                yield event_data
            await asyncio.sleep(0.1)  # Check every 100ms

    try:
        return EventSourceResponse(generate())
    except Exception as e:
        logger.error(f"Error setting up SSE stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        await package_manager.update_status(
            "download",
            "in_progress",
            f"Downloading package {filename}",
            {"filename": filename}
        )

        file_path = package_manager.get_package_path(filename)
        if not file_path:
            await package_manager.update_status(
                "download",
                "error",
                f"Package {filename} not found",
                {"filename": filename}
            )
            raise HTTPException(status_code=404, detail="Package not found")

        await package_manager.update_status(
            "download",
            "complete",
            f"Successfully downloaded package {filename}",
            {"filename": filename}
        )

        return FileResponse(
            file_path,
            filename=filename,
            media_type='application/zip'
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error downloading package {filename}: {error_msg}")
        await package_manager.update_status(
            "download",
            "error",
            f"Error downloading package {filename}",
            {
                "filename": filename,
                "error": error_msg
            }
        )
        raise HTTPException(status_code=500, detail=error_msg)

@datapackage_manager.delete('/delete/{filename}')
async def delete_package(filename: str):
    """Delete a specific data package"""
    try:
        result = await package_manager.delete_package(filename)
        if not result['success']:
            raise HTTPException(status_code=404, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting package {filename}: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage_manager.delete('/delete')
async def delete_packages(request: DeleteRequest):
    """Delete multiple data packages"""
    try:
        if not request.filenames:
            raise HTTPException(status_code=400, detail="Filenames list is empty")

        result = await package_manager.delete_batch(request.filenames)
        if not result['success']:
            raise HTTPException(status_code=404, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting packages: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage_manager.post('/download')
async def download_packages(request: DeleteRequest):
    """Download multiple data packages"""
    try:
        if not request.filenames:
            raise HTTPException(status_code=400, detail="Filenames list is empty")

        result = await package_manager.download_batch(request.filenames)
        if not result['success']:
            raise HTTPException(status_code=404, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error downloading packages: {error_message}")
        raise HTTPException(status_code=500, detail=error_message) 