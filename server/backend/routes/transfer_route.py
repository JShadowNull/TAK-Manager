# Path: backend/routes/transfer_route.py

from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any, AsyncGenerator
import json
import asyncio
import os
from backend.services.scripts.transfer.transfer import RapidFileTransfer
from backend.config.logging_config import configure_logging

# Setup basic logging
logger = configure_logging(__name__)

# Router setup
transfer = APIRouter()

# Global state for SSE events
_latest_transfer_status: Dict[str, Any] = {}
_latest_device_status: Dict[str, Any] = {}
_latest_file_status: Dict[str, Any] = {}

# Global transfer manager instance
transfer_manager = None

def get_transfer_manager():
    global transfer_manager
    if transfer_manager is None:
        async def emit_event(data: Dict[str, Any]):
            event_type = data.get('type', '')
            if event_type == 'transfer_update':
                global _latest_transfer_status
                _latest_transfer_status = data.get('data', {})
            elif event_type == 'device_update':
                global _latest_device_status
                _latest_device_status = data.get('data', {})
            elif event_type == 'file_update':
                global _latest_file_status
                _latest_file_status = data.get('data', {})
        
        transfer_manager = RapidFileTransfer(emit_event=emit_event)
    return transfer_manager

async def transfer_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate transfer status events."""
    manager = get_transfer_manager()
    async for event in manager.status_generator():
        yield event

@transfer.get('/transfer-status-stream')
async def transfer_status_stream():
    """SSE endpoint for transfer status updates."""
    return EventSourceResponse(transfer_status_generator())

@transfer.post('/start-monitoring')
async def start_monitoring():
    """Start monitoring for connected devices."""
    try:
        manager = get_transfer_manager()
        manager.start_monitoring()
        
        # Start monitoring in background task
        asyncio.create_task(manager.monitor_devices())
        
        return Response(status_code=200)
    except Exception as e:
        logger.error(f"Error starting monitoring: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/stop-monitoring')
async def stop_monitoring():
    """Stop monitoring for connected devices."""
    try:
        manager = get_transfer_manager()
        manager.stop_monitoring()
        return Response(status_code=200)
    except Exception as e:
        logger.error(f"Error stopping monitoring: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/start-transfer')
async def start_transfer():
    """Start file transfer to all connected devices."""
    try:
        manager = get_transfer_manager()
        device_ids = manager.start_transfer_all_devices()
        
        if not device_ids:
            raise HTTPException(status_code=400, detail="No connected devices found or no files to transfer")
        
        # Start transfer for each device in background tasks
        for device_id in device_ids:
            asyncio.create_task(manager.start_transfer(device_id))
        
        return Response(status_code=200)
    except Exception as e:
        logger.error(f"Error starting transfer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/stop-transfer')
async def stop_transfer():
    """Stop all active transfers."""
    try:
        manager = get_transfer_manager()
        manager.stop_transfer()
        return Response(status_code=200)
    except Exception as e:
        logger.error(f"Error stopping transfer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.get('/transfer-status')
async def get_transfer_status():
    """Get current transfer status."""
    try:
        manager = get_transfer_manager()
        manager.get_transfer_status()
        return _latest_transfer_status
    except Exception as e:
        logger.error(f"Error getting transfer status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.get('/connected-devices')
async def get_connected_devices():
    """Get list of currently connected devices."""
    try:
        manager = get_transfer_manager()
        manager.emit_connected_devices()
        return _latest_device_status
    except Exception as e:
        logger.error(f"Error getting connected devices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


