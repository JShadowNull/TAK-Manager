from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from sse_starlette.sse import EventSourceResponse
from backend.services.scripts.ota.ota_updates import OTAUpdate
from backend.services.scripts.takserver.check_status import TakServerStatus
from typing import Dict, Any, Optional, AsyncGenerator
import json
import asyncio
import time
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

# Create router
ota = APIRouter()

# Global state for SSE events
_latest_ota_status: Dict[str, Any] = {}

def emit_ota_event(data: Dict[str, Any]) -> None:
    """Update the latest OTA status state"""
    global _latest_ota_status
    _latest_ota_status = data
    logger.debug(f"OTA status updated: {json.dumps(data)}")

async def ota_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate OTA status events for SSE"""
    while True:
        if _latest_ota_status:
            yield _latest_ota_status
        await asyncio.sleep(1)

@ota.post("/configure")
async def configure_ota(file: UploadFile = File(...)):
    """Configure OTA update with uploaded file"""
    try:
        # Save uploaded file
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Initialize OTA updater with event emission
        ota_updater = OTAUpdate(file_path, emit_event=emit_ota_event)
        
        # Run configuration in background
        asyncio.create_task(ota_updater.main())
        
        return {"message": "OTA configuration started", "status": "processing"}
    except Exception as e:
        logger.error(f"Error in configure_ota: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ota.post("/update")
async def update_ota(file: UploadFile = File(...)):
    """Update OTA with uploaded file"""
    try:
        # Save uploaded file
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Initialize OTA updater with event emission
        ota_updater = OTAUpdate(file_path, emit_event=emit_ota_event)
        
        # Run update in background
        asyncio.create_task(ota_updater.update())
        
        return {"message": "OTA update started", "status": "processing"}
    except Exception as e:
        logger.error(f"Error in update_ota: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ota.get("/status-stream")
async def ota_status_stream():
    """Stream OTA status updates via SSE"""
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