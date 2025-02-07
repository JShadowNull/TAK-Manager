from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from sse_starlette.sse import EventSourceResponse
from backend.services.scripts.ota.ota_updates import OTAUpdate
from typing import Dict, Any, AsyncGenerator
import json
import asyncio
import os
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

# Create router
ota = APIRouter()

# Global state for SSE events
_latest_ota_status: Dict[str, Any] = {}

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

async def ota_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate OTA status events for SSE"""
    last_status = None
    while True:
        if _latest_ota_status and _latest_ota_status != last_status:
            # Don't mark terminal output as errors if ignore_errors is True
            if _latest_ota_status.get("type") == "terminal" and not _latest_ota_status.get("isError", False):
                _latest_ota_status["isError"] = False
            
            event_data = {
                "event": "ota-status",
                "data": json.dumps(_latest_ota_status)
            }
            logger.debug(f"Sending OTA status SSE: {event_data}")
            last_status = _latest_ota_status.copy()
            yield event_data
        await asyncio.sleep(0.1)  # Check every 100ms for more responsive updates

@ota.post("/configure")
async def configure_ota(file: UploadFile = File(...)):
    """Configure OTA update with uploaded file"""
    logger.debug("Starting OTA configuration")
    logger.debug(f"Received file: {file.filename}")
    
    try:
        # Save file
        upload_dir = get_upload_path()
        file_path = os.path.join(upload_dir, file.filename)
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.debug("File saved successfully")

        # Create OTA updater with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_ota_status
            if _latest_ota_status != data:  # Only emit if the data has changed
                _latest_ota_status = data
                logger.debug(f"Emitting OTA status event: {data}")

        logger.debug("Creating OTA updater")
        ota_updater = OTAUpdate(file_path, emit_event=emit_event)

        logger.debug("Starting configuration process")
        success = await ota_updater.main()
        logger.debug(f"Configuration completed with success={success}")
        
        # Clean up uploaded file regardless of success
        if os.path.exists(file_path):
            logger.debug(f"Cleaning up uploaded file: {file_path}")
            os.remove(file_path)
            
        if not success:
            logger.error("Configuration failed")
            raise HTTPException(status_code=500, detail="Configuration failed")
            
        logger.debug("Configuration completed successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ota.post("/update")
async def update_ota(file: UploadFile = File(...)):
    """Update OTA with uploaded file"""
    logger.debug("Starting OTA update")
    logger.debug(f"Received file: {file.filename}")
    
    try:
        # Save file
        upload_dir = get_upload_path()
        file_path = os.path.join(upload_dir, file.filename)
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.debug("File saved successfully")

        # Create OTA updater with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_ota_status
            if _latest_ota_status != data:  # Only emit if the data has changed
                _latest_ota_status = data
                logger.debug(f"Emitting OTA status event: {data}")

        logger.debug("Creating OTA updater")
        ota_updater = OTAUpdate(file_path, emit_event=emit_event)

        logger.debug("Starting update process")
        success = await ota_updater.update()
        logger.debug(f"Update completed with success={success}")
        
        # Clean up uploaded file regardless of success
        if os.path.exists(file_path):
            logger.debug(f"Cleaning up uploaded file: {file_path}")
            os.remove(file_path)
            
        if not success:
            logger.error("Update failed")
            raise HTTPException(status_code=500, detail="Update failed")
            
        logger.debug("Update completed successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ota.get("/status-stream")
async def ota_status_stream():
    """SSE endpoint for OTA status updates."""
    return EventSourceResponse(ota_status_generator())

@ota.get("/status")
async def get_ota_status():
    """Get current OTA status"""
    return _latest_ota_status if _latest_ota_status else {
        "status": "idle",
        "message": "No OTA operation in progress",
        "progress": 0,
        "isInProgress": False
    }