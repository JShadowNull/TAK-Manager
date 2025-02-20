from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any
import json
import asyncio
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
import os
from backend.config.logging_config import configure_logging
import time
from backend.services.helpers.directories import DirectoryHelper
import contextlib

# Setup basic logging
logger = configure_logging(__name__)

# Router setup
takserver = APIRouter()
status_checker = TakServerStatus()

# Event queues for different operations
install_queue = asyncio.Queue()
uninstall_queue = asyncio.Queue()
server_status_queue = asyncio.Queue()

# Track last events to prevent duplicates
_last_events = {
    'install-status': None,
    'uninstall-status': None,
    'server-status': None
}

# Add global state tracking
operation_in_progress = False
operation_state_lock = asyncio.Lock()

@contextlib.asynccontextmanager
async def operation_context():
    """Context manager to track in-progress operations."""
    global operation_in_progress
    async with operation_state_lock:
        operation_in_progress = True
        try:
            yield
        finally:
            operation_in_progress = False

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
    """Server-Sent Events (SSE) stream for installation progress.
    
    API Endpoint:
        GET /install-status-stream
        
    Events:
        - install-status: JSON payload with progress updates
        - terminal: Raw terminal output lines
        - ping: Empty keep-alive messages
        
    Client should:
        - Handle JSON messages for structured data
        - Display terminal messages as console output
        - Reconnect on connection drop
    """
    logger.debug("New install status stream connection established")
    return await create_sse_response(install_queue, "install-status")

@takserver.get('/uninstall-status-stream')
async def uninstall_status_stream():
    """Server-Sent Events (SSE) stream for uninstallation progress.
    
    API Endpoint:
        GET /uninstall-status-stream
        
    Events:
        - uninstall-status: JSON payload with progress updates
        - terminal: Raw terminal output lines
        - ping: Empty keep-alive messages
    """
    logger.debug("New uninstall status stream connection established")
    return await create_sse_response(uninstall_queue, "uninstall-status")

@takserver.get('/server-status-stream')
async def server_status_stream():
    """Real-time server status updates via SSE.
    
    API Endpoint:
        GET /server-status-stream
        
    Events:
        - server-status: JSON payload with current status:
            {
                "type": "status",
                "data": {
                    "isInstalled": bool,
                    "isRunning": bool,
                    "version": str|null
                },
                "timestamp": int
            }
        - ping: Empty keep-alive messages
        
    Note: Automatically pushes updates when status changes
    """
    logger.debug("New server status stream connection established")
    return await create_sse_response(server_status_queue, "server-status")

# Background service monitoring
async def update_server_status():
    """Background task that continuously monitors server status.
    
    Runs every 1 second to:
    1. Check current installation status
    2. Verify container health
    3. Push updates to server-status-stream
    4. Maintain SSE connections
    
    Handles:
    - Installation detection
    - Version tracking
    - Container state changes
    - Error recovery attempts
    """
    last_status = None
    last_ping = time.time()
    while True:
        try:
            if operation_in_progress:
                # Send pings to maintain connection
                if time.time() - last_ping > 30:  # 30 seconds ping interval
                    await server_status_queue.put({"type": "ping"})
                    last_ping = time.time()
                await asyncio.sleep(0.5)
                continue

            # Force immediate status check after operations
            status = await status_checker.get_status()
            status_str = json.dumps(status, sort_keys=True)
            
            if status_str != last_status:
                logger.info("Server status changed: %s", status)
                event = {
                    "type": "status",
                    "data": status,
                    "timestamp": int(time.time() * 1000)
                }
                await server_status_queue.put(event)
                last_status = status_str
                last_ping = time.time()  # Reset ping timer on status change
            else:
                # Send periodic pings to keep connection alive
                if time.time() - last_ping > 30:  # 30 seconds ping interval
                    await server_status_queue.put({"type": "ping"})
                    last_ping = time.time()

            await asyncio.sleep(1)
            
        except Exception as e:
            if os.path.exists(status_checker.directory_helper.get_docker_compose_directory()):
                logger.error("Status monitoring error: %s", str(e), exc_info=True)
            else:
                logger.debug("Status check failed - no installation present")
            
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
    """Install and configure a new TAK Server instance.
    
    API Endpoint:
        POST /install-takserver
        Content-Type: multipart/form-data
        
    Parameters:
        - docker_zip_file (UploadFile): ZIP archive containing Docker configuration files
        - postgres_password (str): Password for PostgreSQL database (required)
        - certificate_password (str): Password for server certificates (required)
        - organization (str): Organization name for server configuration
        - state (str): State/location for server configuration
        - city (str): City for server configuration
        - organizational_unit (str): Organizational unit for server configuration
        - name (str): Server name/identifier
        
    Returns:
        - 200: Empty response on successful installation
        - 500: Error details if installation fails
        
    Process:
        1. Validate and save uploaded Docker configuration
        2. Configure server with provided parameters
        3. Initialize database and security certificates
        4. Start containerized services
    """
    logger.info(
        "Starting TAK server installation with organization: %s, location: %s/%s/%s",
        organization, state, city, organizational_unit
    )
    
    try:
        upload_dir = DirectoryHelper.get_upload_directory()
        file_path = os.path.join(upload_dir, docker_zip_file.filename)
        
        logger.debug("Saving uploaded file to: %s", file_path)
        with open(file_path, "wb") as buffer:
            content = await docker_zip_file.read()
            buffer.write(content)

        async def emit_event(data: Dict[str, Any]):
            logger.debug("Installation progress update: %s", data.get('type', 'unknown_event'))
            await install_queue.put(data)

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
            logger.debug("Cleaning up temporary installation file")
            os.remove(file_path)
            
        if not success:
            logger.error("Installation failed without raising exception")
            raise HTTPException(status_code=500, detail="Installation failed")
            
        logger.info("TAK server installed successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error(
            "Installation failed for organization %s: %s",
            organization, str(e), exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/uninstall-takserver')
async def uninstall_takserver():
    """Completely remove TAK Server installation.
    
    API Endpoint:
        POST /uninstall-takserver
        
    Returns:
        - 200: Empty response on successful uninstallation
        - 500: Error details if uninstallation fails
        
    Process:
        1. Stop running containers
        2. Remove Docker resources
        3. Delete configuration files
        4. Clean up database and certificates
    """
    logger.info("Starting TAK server uninstallation")
    try:
        async def emit_event(data: Dict[str, Any]):
            logger.debug("Uninstallation progress update: %s", data.get('type', 'unknown_event'))
            await uninstall_queue.put(data)

        uninstaller = TakServerUninstaller(emit_event=emit_event)
        success = await uninstaller.uninstall()
            
        if not success:
            logger.error("Uninstallation failed without raising exception")
            raise HTTPException(status_code=500, detail="Uninstallation failed")
            
        logger.info("TAK server uninstalled successfully")
        return Response(status_code=200)

    except Exception as e:
        logger.error("Uninstallation failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/start-takserver')
async def start_takserver():
    """Start TAK Server containers.
    
    API Endpoint:
        POST /start-takserver
        
    Returns:
        - 200: {status: "success", message: "Containers started"}
        - 500: Error details including Docker output if startup fails
    """
    try:
        async with operation_context():
            status_checker = TakServerStatus()
            result = await status_checker.start_containers()
            return result
    except Exception as e:
        logger.error(f"Start error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/stop-takserver')
async def stop_takserver():
    """Stop TAK Server containers and services.
    
    API Endpoint:
        POST /stop-takserver
        
    Returns:
        - 200: {status: "success", message: "Containers stopped"}
        - 500: Error details including Docker output if shutdown fails
    """
    try:
        async with operation_context():
            status_checker = TakServerStatus()
            result = await status_checker.stop_containers()
            return result
    except Exception as e:
        logger.error(f"Stop error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@takserver.post('/restart-takserver')
async def restart_takserver():
    """Restart TAK Server containers.
    
    API Endpoint:
        POST /restart-takserver
        
    Returns:
        - 200: {status: "success", message: "Containers restarted"}
        - 500: Error details including Docker output if restart fails
    """
    try:
        async with operation_context():
            status_checker = TakServerStatus()
            result = await status_checker.restart_containers()
            return result
    except Exception as e:
        logger.error(f"Restart error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@takserver.get('/takserver-status')
async def get_takserver_status():
    """Get current installation and operational status.
    
    API Endpoint:
        GET /takserver-status
        
    Returns:
        - 200: JSON status object:
            {
                "isInstalled": bool,
                "isRunning": bool,
                "version": str|null
            }
        - 500: Error details if status check fails
        
    Note: Checks for both installation presence and container status
    """
    try:
        logger.debug("Processing status check request")
        status = await status_checker.get_status()
        logger.info("Status check completed - Installed: %s, Running: %s",
                   status['isInstalled'], status['isRunning'])
        return status
    except Exception as e:
        logger.error("Status check failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@takserver.get('/webui-status')
async def get_webui_status():
    """Check if TAK Server web UI is available.
    
    API Endpoint:
        GET /webui-status
    
    Returns:
        - 200: JSON response with availability status:
            {
                "status": "available"|"unavailable"|"error",
                "message": str,
                "error": str|null
            }
        - 500: Error details if check fails
    """
    try:
        status_checker = TakServerStatus()
        result = await status_checker.check_webui_availability()
        return result
    except Exception as e:
        logger.error(f"Web UI status check failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))