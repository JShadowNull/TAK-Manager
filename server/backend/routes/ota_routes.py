from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from sse_starlette.sse import EventSourceResponse
from backend.services.scripts.ota.ota_updates import OTAUpdate
from typing import Dict, Any, AsyncGenerator
import json
import asyncio
import os
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper

# Configure logging using centralized config
logger = configure_logging(__name__)

# Create router
ota = APIRouter()

# Event queue for OTA operations
ota_queue = asyncio.Queue()

# Track last events to prevent duplicates
_last_events = {
    'ota-status': None
}

async def create_sse_response(queue: asyncio.Queue, event_type: str):
    """Generic SSE response generator for any queue."""
    async def generate():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=60)
                    if isinstance(event, dict):
                        # For terminal output, always send it
                        if event.get('type') == 'terminal':
                            yield {
                                "event": event_type,
                                "data": json.dumps(event)
                            }
                            continue

                        # For other events, check for changes
                        event_str = json.dumps(event, sort_keys=True)
                        if _last_events[event_type] != event_str:
                            _last_events[event_type] = event_str
                            yield {
                                "event": event_type,
                                "data": json.dumps(event)
                            }
                    else:
                        # For non-dict events, always send them
                        yield {
                            "event": event_type,
                            "data": json.dumps(event)
                        }
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
                except asyncio.CancelledError:
                    break
        except asyncio.CancelledError:
            pass
    return EventSourceResponse(generate())

@ota.get('/status-stream')
async def ota_status_stream():
    """SSE endpoint for OTA status updates."""
    return await create_sse_response(ota_queue, "ota-status")

@ota.post("/configure")
async def configure_ota(file: UploadFile = File(...)):
    """Configure OTA update with uploaded file"""
    logger.debug("Starting OTA configuration")
    logger.debug(f"Received file: {file.filename}")
    try:
        # Save file
        upload_dir = DirectoryHelper.get_upload_directory()
        file_path = os.path.join(upload_dir, file.filename)
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.debug("File saved successfully")

        # Create OTA updater with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            await ota_queue.put(data)
            logger.debug(f"Emitted OTA status event: {data}")

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
        upload_dir = DirectoryHelper.get_upload_directory()
        file_path = os.path.join(upload_dir, file.filename)
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.debug("File saved successfully")

        # Create OTA updater with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            await ota_queue.put(data)
            logger.debug(f"Emitted OTA status event: {data}")

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

@ota.get("/status")
async def get_ota_status():
    """Get current OTA status"""
    status = _last_events.get('ota-status')
    if status:
        try:
            return json.loads(status)
        except:
            pass
    return {
        "status": "idle",
        "message": "No OTA operation in progress",
        "progress": 0,
        "isInProgress": False
    }