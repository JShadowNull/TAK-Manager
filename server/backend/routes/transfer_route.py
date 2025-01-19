# Path: backend/routes/transfer_route.py

from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response, JSONResponse
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any, List, AsyncGenerator
import json
import asyncio
import os
from backend.services.scripts.transfer.transfer import RapidFileTransfer
from backend.config.logging_config import configure_logging

# Setup basic logging
logger = configure_logging(__name__)

# Router setup
transfer = APIRouter()

# Global transfer manager instance
transfer_manager = None

# Global event queue
event_queue = asyncio.Queue()

async def get_transfer_manager():
    """Get or create transfer manager instance"""
    global transfer_manager
    if transfer_manager is None:
        async def emit_event(data: Dict[str, Any]):
            await event_queue.put(data)
        
        transfer_manager = RapidFileTransfer(emit_event=emit_event)
    return transfer_manager

async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate SSE events for transfer status updates."""
    try:
        while True:
            # Get event from queue with timeout
            try:
                event = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                if event:
                    yield {
                        "event": "message",
                        "data": json.dumps(event),
                        "retry": 5000
                    }
            except asyncio.TimeoutError:
                # Send keepalive every second if no events
                yield {
                    "event": "keepalive",
                    "data": "",
                    "retry": 5000
                }
    except asyncio.CancelledError:
        logger.info("Client disconnected, stopping event generator")
        raise
    except Exception as e:
        logger.error(f"Error in event generator: {str(e)}")
        raise

@transfer.get('/transfer-status-stream')
async def transfer_status_stream():
    """SSE endpoint for transfer status updates."""
    return EventSourceResponse(event_generator())

@transfer.post('/start-monitoring')
async def start_monitoring():
    """Start monitoring for connected devices."""
    try:
        manager = await get_transfer_manager()
        manager.start_monitoring()
        
        # Start monitoring in background task
        asyncio.create_task(manager.monitor_devices())
        
        return JSONResponse(content={"status": "success", "message": "Device monitoring started"})
    except Exception as e:
        logger.error(f"Error starting monitoring: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/stop-monitoring')
async def stop_monitoring():
    """Stop monitoring for connected devices."""
    try:
        manager = await get_transfer_manager()
        manager.stop_monitoring()
        return JSONResponse(content={"status": "success", "message": "Device monitoring stopped"})
    except Exception as e:
        logger.error(f"Error stopping monitoring: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/start-transfer')
async def start_transfer():
    """Start file transfer to all connected devices."""
    try:
        manager = await get_transfer_manager()
        device_ids = await manager.start_transfer_all_devices()
        
        if not device_ids:
            raise HTTPException(
                status_code=400, 
                detail="No connected devices found or no files to transfer"
            )
        
        # Start transfer for each device in background tasks
        tasks = [
            asyncio.create_task(manager.start_transfer(device_id))
            for device_id in device_ids
        ]
        
        # Wait for all transfers to start but don't block
        asyncio.create_task(asyncio.gather(*tasks))
        
        return JSONResponse(
            content={
                "status": "success",
                "message": f"Transfer started for {len(device_ids)} device(s)",
                "devices": device_ids
            }
        )
    except Exception as e:
        logger.error(f"Error starting transfer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/stop-transfer')
async def stop_transfer():
    """Stop all active transfers."""
    try:
        manager = await get_transfer_manager()
        await manager.stop_transfer()
        return JSONResponse(content={"status": "success", "message": "All transfers stopped"})
    except Exception as e:
        logger.error(f"Error stopping transfer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.get('/transfer-status')
async def get_transfer_status():
    """Get current transfer status."""
    try:
        manager = await get_transfer_manager()
        await manager.get_transfer_status()
        return JSONResponse(content={"status": "success", "message": "Transfer status updated"})
    except Exception as e:
        logger.error(f"Error getting transfer status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.get('/connected-devices')
async def get_connected_devices():
    """Get list of currently connected devices."""
    try:
        manager = await get_transfer_manager()
        await manager.emit_connected_devices()
        return JSONResponse(content={"status": "success", "message": "Device list updated"})
    except Exception as e:
        logger.error(f"Error getting connected devices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/upload')
async def upload_files(files: List[UploadFile]):
    """Upload files for transfer."""
    try:
        manager = await get_transfer_manager()
        uploaded_files = []
        
        for file in files:
            # Create temp directory if it doesn't exist
            if not os.path.exists(manager.temp_dir):
                os.makedirs(manager.temp_dir)
            
            # Save file to temp directory
            file_path = os.path.join(manager.temp_dir, file.filename)
            with open(file_path, 'wb') as f:
                content = await file.read()
                f.write(content)
            uploaded_files.append(file.filename)
        
        return JSONResponse(
            content={
                "status": "success",
                "message": f"Successfully uploaded {len(uploaded_files)} file(s)",
                "files": uploaded_files
            }
        )
    except Exception as e:
        logger.error(f"Error uploading files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@transfer.post('/delete-file')
async def delete_file(filename: str):
    """Delete a file from the temp directory."""
    try:
        manager = await get_transfer_manager()
        file_path = os.path.join(manager.temp_dir, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse(
                content={
                    "status": "success",
                    "message": f"Successfully deleted {filename}"
                }
            )
        else:
            raise HTTPException(
                status_code=404,
                detail=f"File {filename} not found"
            )
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


