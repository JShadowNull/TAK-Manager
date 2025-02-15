# backend/routes/docker_manager_routes.py

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel
from typing import Dict, Any
import docker
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.config.logging_config import configure_logging
import json

logger = configure_logging(__name__)

# Router setup
dockermanager = APIRouter()

docker_manager = DockerManager()

# Response Models
class ContainerResponse(BaseModel):
    status: str
    message: str

@dockermanager.get('/containers/status-stream')
async def container_status_stream():
    """SSE endpoint for container status updates"""
    async def event_generator():
        async for status in docker_manager.status_generator():
            yield ServerSentEvent(json.dumps(status), event='docker_status')
    return EventSourceResponse(event_generator())

@dockermanager.post('/containers/updates/start', response_model=ContainerResponse)
async def start_container_updates():
    """Get initial container status"""
    try:
        status = docker_manager.get_container_status()
        return ContainerResponse(
            status='success',
            message='Container status retrieved'
        )
    except Exception as e:
        logger.error(f"Failed to get container status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@dockermanager.post('/containers/{container_name}/start', response_model=ContainerResponse)
async def start_container(container_name: str):
    """Start a Docker container"""
    try:
        await docker_manager.start_container(container_name)
        return ContainerResponse(
            status='success',
            message='Container started successfully'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dockermanager.post('/containers/{container_name}/stop', response_model=ContainerResponse)
async def stop_container(container_name: str):
    """Stop a Docker container"""
    try:
        await docker_manager.stop_container(container_name)
        return ContainerResponse(
            status='success',
            message='Container stopped successfully'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@dockermanager.post('/container/{container_id}/restart', response_model=ContainerResponse)
async def restart_container(container_id: str):
    """Restart a container by ID"""
    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
        container.restart()
        return ContainerResponse(
            status='success',
            message='Container restarted successfully'
        )
    except Exception as e:
        logger.error(f"Failed to restart container {container_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


