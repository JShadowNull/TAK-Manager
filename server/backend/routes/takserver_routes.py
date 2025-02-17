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
from backend.services.helpers.directories import DirectoryHelper
# Setup basic logging
logger = configure_logging(__name__)

# Router setup
takserver = APIRouter()
status_checker = TakServerStatus()

# Event queues for different operations
install_queue = asyncio.Queue()
uninstall_queue = asyncio.Queue()
operation_queue = asyncio.Queue()
server_status_queue = asyncio.Queue()

# Track last events to prevent duplicates
_last_events = {
    'install-status': None,
    'uninstall-status': None,
    'operation-status': None,
    'server-status': None
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

@takserver.get('/install-status-stream')
async def install_status_stream():
    """SSE endpoint for installation progress and terminal output."""
    return await create_sse_response(install_queue, "install-status")

@takserver.get('/uninstall-status-stream')
async def uninstall_status_stream():
    """SSE endpoint for uninstallation progress and terminal output."""
    return await create_sse_response(uninstall_queue, "uninstall-status")

@takserver.get('/operation-status-stream')
async def operation_status_stream():
    """SSE endpoint for container operation status updates."""
    return await create_sse_response(operation_queue, "operation-status")

@takserver.get('/server-status-stream')
async def server_status_stream():
    """SSE endpoint for TAK server installation and running state."""
    return await create_sse_response(server_status_queue, "server-status")

# Background task to update server status
async def update_server_status():
    last_status = None
    while True:
        try:
            status = await status_checker.get_status()
            status_str = json.dumps(status, sort_keys=True)
            if status_str != last_status:
                await server_status_queue.put({
                    "type": "status",
                    "data": status,
                    "timestamp": int(time.time() * 1000)
                })
                last_status = status_str
        except Exception as e:
            if os.path.exists(status_checker.directory_helper.get_docker_compose_directory()):
                logger.error(f"Status check error: {str(e)}")
            
            error_status = {
                "type": "status",
                "data": {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": None
                },
                "timestamp": int(time.time() * 1000)
            }
            error_status_str = json.dumps(error_status, sort_keys=True)
            if error_status_str != last_status:
                await server_status_queue.put(error_status)
                last_status = error_status_str
        await asyncio.sleep(1)

# Start the background task
@takserver.on_event("startup")
async def startup_event():
    asyncio.create_task(update_server_status())

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
    
    try:
        upload_dir = DirectoryHelper.get_upload_directory()
        file_path = os.path.join(upload_dir, docker_zip_file.filename)
        
        with open(file_path, "wb") as buffer:
            content = await docker_zip_file.read()
            buffer.write(content)

        async def emit_event(data: Dict[str, Any]):
            await install_queue.put(data)
            logger.debug(f"Emitted install event: {data}")

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

        success = await installer.main()
        
        if os.path.exists(file_path):
            os.remove(file_path)
            
        if not success:
            raise HTTPException(status_code=500, detail="Installation failed")
            
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Installation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/uninstall-takserver')
async def uninstall_takserver():
    """Uninstall TAK server."""
    try:
        async def emit_event(data: Dict[str, Any]):
            await uninstall_queue.put(data)
            logger.debug(f"Emitted uninstall event: {data}")

        uninstaller = TakServerUninstaller(emit_event=emit_event)
        success = await uninstaller.uninstall()
            
        if not success:
            raise HTTPException(status_code=500, detail="Uninstallation failed")
            
        return Response(status_code=200)

    except Exception as e:
        logger.error(f"Uninstallation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/start-takserver')
async def start_takserver():
    """Start TAK server containers."""
    try:
        async def emit_event(data: Dict[str, Any]):
            await operation_queue.put(data)
            logger.debug(f"Emitted operation event: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.start_containers()
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
            
        return result
    except Exception as e:
        logger.error(f"Start error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/stop-takserver')
async def stop_takserver():
    """Stop TAK server containers."""
    try:
        async def emit_event(data: Dict[str, Any]):
            await operation_queue.put(data)
            logger.debug(f"Emitted operation event: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.stop_containers()
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
            
        return result
    except Exception as e:
        logger.error(f"Stop error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/restart-takserver')
async def restart_takserver():
    """Restart TAK server containers."""
    try:
        async def emit_event(data: Dict[str, Any]):
            await operation_queue.put(data)
            logger.debug(f"Emitted operation event: {data}")

        status_checker = TakServerStatus(emit_event=emit_event)
        result = await status_checker.restart_containers()
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
            
        return result
    except Exception as e:
        logger.error(f"Restart error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@takserver.get('/takserver-status')
async def get_takserver_status():
    """Get current TAK server status."""
    try:
        status = await status_checker.get_status()
        return status
    except Exception as e:
        logger.error(f"Unexpected status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))