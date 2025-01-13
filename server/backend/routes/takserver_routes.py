from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse
from typing import AsyncGenerator, Dict, Any
import json
import asyncio
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
import os
from backend.config.logging_config import configure_logging
import time

# Setup basic logging
logger = configure_logging(__name__)

# Router setup
takserver = APIRouter()
status_checker = TakServerStatus()

# Global state for SSE events
_latest_operation_status: Dict[str, Any] = {}
_latest_install_status: Dict[str, Any] = {}
_latest_uninstall_status: Dict[str, Any] = {}
_operation_in_progress = False

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

async def server_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate TAK server status events (installation and running state)."""
    last_status = None
    while True:
        try:
            status = await status_checker.get_status()
            status_data = {
                "isInstalled": status["isInstalled"],
                "isRunning": status["isRunning"],
                "version": status["version"]
            }
            
            # Only emit if status has changed
            if status_data != last_status:
                event_data = {
                    "event": "server-status",
                    "data": json.dumps(status_data)
                }
                logger.debug(f"Sending server status SSE: {event_data}")
                last_status = status_data
                yield event_data
        except Exception as e:
            logger.error(f"Error generating server status: {str(e)}")
            error_data = {
                "isInstalled": False,
                "isRunning": False,
                "version": "Error",
                "error": str(e)
            }
            if error_data != last_status:
                event_data = {
                    "event": "server-status",
                    "data": json.dumps(error_data)
                }
                logger.debug(f"Sending error server status SSE: {event_data}")
                last_status = error_data
                yield event_data
        await asyncio.sleep(1)  # Check every second

async def operation_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate container operation status events (start/stop/restart progress)."""
    last_status = None
    while True:
        if _latest_operation_status and _latest_operation_status != last_status:
            event_data = {
                "event": "operation-status",
                "data": json.dumps(_latest_operation_status)
            }
            logger.debug(f"Sending operation status SSE: {event_data}")
            last_status = _latest_operation_status.copy()
            yield event_data
        await asyncio.sleep(1)  # Check every second

async def install_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate installation status events (progress, terminal output)."""
    last_status = None
    while True:
        if _latest_install_status and _latest_install_status != last_status:
            # Don't mark Docker output as errors if ignore_errors is True
            if _latest_install_status.get("type") == "terminal" and not _latest_install_status.get("isError", False):
                _latest_install_status["isError"] = False
            
            event_data = {
                "event": "install-status", 
                "data": json.dumps(_latest_install_status)
            }
            logger.debug(f"Sending install status SSE: {event_data}")
            last_status = _latest_install_status.copy()
            yield event_data
        await asyncio.sleep(0)

async def uninstall_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate uninstallation status events (progress, terminal output)."""
    last_status = None
    while True:
        if _latest_uninstall_status and _latest_uninstall_status != last_status:
            # Don't mark Docker output as errors if ignore_errors is True
            if _latest_uninstall_status.get("type") == "terminal" and not _latest_uninstall_status.get("isError", False):
                _latest_uninstall_status["isError"] = False
            
            event_data = {
                "event": "uninstall-status",
                "data": json.dumps(_latest_uninstall_status)
            }
            logger.debug(f"Sending uninstall status SSE: {event_data}")
            last_status = _latest_uninstall_status.copy()
            yield event_data
        await asyncio.sleep(0.1)  # Check every 100ms for more responsive updates

@takserver.get('/server-status-stream')
async def server_status_stream():
    """SSE endpoint for TAK server installation and running state."""
    async def generate():
        last_status = None
        while True:
            try:
                # Only get and emit status if no operation is in progress
                if not _operation_in_progress:
                    status = await status_checker.get_status()
                    # Only emit if status changed
                    if status is not None and status != last_status:
                        event_data = {
                            "event": "server-status",
                            "data": json.dumps(status)
                        }
                        logger.debug(f"Sending server status SSE: {event_data}")
                        last_status = status.copy()
                        yield event_data
            except Exception as e:
                logger.error(f"Error generating server status: {str(e)}")
                error_data = {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": "Error",
                    "error": str(e)
                }
                event_data = {
                    "event": "server-status",
                    "data": json.dumps(error_data)
                }
                logger.debug(f"Sending error server status SSE: {event_data}")
                yield event_data
            await asyncio.sleep(1)  # Check every second

    return EventSourceResponse(generate())

@takserver.get('/operation-status-stream')
async def operation_status_stream():
    """SSE endpoint for container operation status updates."""
    return EventSourceResponse(operation_status_generator())

@takserver.get('/install-status-stream')
async def install_status_stream():
    """SSE endpoint for installation progress and terminal output."""
    return EventSourceResponse(install_status_generator())

@takserver.get('/uninstall-status-stream')
async def uninstall_status_stream():
    """SSE endpoint for uninstallation progress and terminal output."""
    return EventSourceResponse(uninstall_status_generator())

@takserver.post('/install-takserver')
async def install_takserver(
    docker_zip_file: UploadFile,
    postgres_password: str = Form(...),
    certificate_password: str = Form(...),
    organization: str = Form(...),
    state: str = Form(...),
    city: str = Form(...),
    organizational_unit: str = Form(...),
    name: str = Form(...)
):
    logger.debug("Starting TAK server installation")
    logger.debug(f"Received file: {docker_zip_file.filename}")
    logger.debug(f"Installation parameters - Organization: {organization}, State: {state}, City: {city}, Unit: {organizational_unit}, Name: {name}")
    
    try:
        # Save file
        upload_dir = get_upload_path()
        file_path = os.path.join(upload_dir, docker_zip_file.filename)
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await docker_zip_file.read()
            buffer.write(content)
        logger.debug("File saved successfully")

        # Create installer with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_install_status
            if _latest_install_status != data:  # Only emit if the data has changed
                _latest_install_status = data
                logger.debug(f"Emitting install status event: {data}")

        logger.debug("Creating TAK Server installer")
        installer = TakServerInstaller(
            docker_zip_path=file_path,
            postgres_password=postgres_password,
            certificate_password=certificate_password,
            organization=organization,
            state=state,
            city=city,
            organizational_unit=organizational_unit,
            name=name,
            emit_event=emit_event
        )

        logger.debug("Starting installation process")
        success = await installer.main()
        logger.debug(f"Installation completed with success={success}")
        
        # Clean up uploaded file regardless of success
        if os.path.exists(file_path):
            logger.debug(f"Cleaning up uploaded file: {file_path}")
            os.remove(file_path)
            
        if not success:
            logger.error("Installation failed")
            raise HTTPException(status_code=500, detail="Installation failed")
            
        logger.debug("Installation completed successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Installation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.get('/takserver-status')
async def get_takserver_status():
    """Get current TAK server status."""
    try:
        status = await status_checker.get_status()
        return status
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/start-takserver')
async def start_takserver():
    """Start TAK server containers."""
    try:
        global _operation_in_progress
        _operation_in_progress = True
        
        # Create status checker with event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_operation_status
            _latest_operation_status = data
            logger.debug(f"Emitting operation status: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.start_containers()
        
        if result["status"] == "error":
            _operation_in_progress = False
            raise HTTPException(status_code=500, detail=result["message"])
            
        _operation_in_progress = False
        return result
    except Exception as e:
        _operation_in_progress = False
        logger.error(f"Start error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/stop-takserver')
async def stop_takserver():
    """Stop TAK server containers."""
    try:
        global _operation_in_progress
        _operation_in_progress = True
        
        # Create status checker with event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_operation_status
            _latest_operation_status = data
            logger.debug(f"Emitting operation status: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.stop_containers()
        
        if result["status"] == "error":
            _operation_in_progress = False
            raise HTTPException(status_code=500, detail=result["message"])
            
        _operation_in_progress = False
        return result
    except Exception as e:
        _operation_in_progress = False
        logger.error(f"Stop error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/restart-takserver')
async def restart_takserver():
    """Restart TAK server containers."""
    try:
        global _operation_in_progress
        _operation_in_progress = True
        
        # Create status checker with event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_operation_status
            _latest_operation_status = data
            logger.debug(f"Emitting operation status: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.restart_containers()
        
        if result["status"] == "error":
            _operation_in_progress = False
            raise HTTPException(status_code=500, detail=result["message"])
            
        _operation_in_progress = False
        return result
    except Exception as e:
        _operation_in_progress = False
        logger.error(f"Restart error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/uninstall-takserver')
async def uninstall_takserver():
    """Uninstall TAK server."""
    logger.debug("Starting TAK server uninstallation")
    
    try:
        # Create uninstaller with SSE event emitter
        async def emit_event(data: Dict[str, Any]):
            global _latest_uninstall_status
            if _latest_uninstall_status != data:  # Only emit if the data has changed
                _latest_uninstall_status = data
                logger.debug(f"Emitting uninstall status event: {data}")

        logger.debug("Creating TAK Server uninstaller")
        uninstaller = TakServerUninstaller(emit_event=emit_event)

        logger.debug("Starting uninstallation process")
        success = await uninstaller.uninstall()
        logger.debug(f"Uninstallation completed with success={success}")
            
        if not success:
            logger.error("Uninstallation failed")
            raise HTTPException(status_code=500, detail="Uninstallation failed")
            
        logger.debug("Uninstallation completed successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Uninstallation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))