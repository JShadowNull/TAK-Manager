# backend/routes/port_manager_routes.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from backend.services.scripts.docker.docker_compose_editor import DockerComposeEditor
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

# Router setup
portmanager = APIRouter()

# Response Models
class PortResponse(BaseModel):
    status: str
    message: str

class PortMappingsResponse(BaseModel):
    status: str
    port_mappings: List[str]

class PortMappingRequest(BaseModel):
    host_port: int
    container_port: Optional[int] = None

@portmanager.get('/ports', response_model=PortMappingsResponse)
async def get_takserver_port_mappings():
    """Get the current port mappings for the takserver service"""
    try:
        # Get the port mappings
        port_mappings = DockerComposeEditor.get_takserver_port_mappings()
        
        return PortMappingsResponse(
            status='success',
            port_mappings=port_mappings
        )
    except Exception as e:
        logger.error(f"Failed to get port mappings: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@portmanager.post('/ports/add', response_model=PortResponse)
async def add_port_to_takserver(port_mapping: PortMappingRequest):
    """Add a port mapping to the takserver service in the docker-compose.yml file"""
    try:
        # Add the port to the docker-compose file
        DockerComposeEditor.add_port_to_takserver(
            host_port=port_mapping.host_port,
            container_port=port_mapping.container_port
        )
        
        return PortResponse(
            status='success',
            message=f'Port mapping {port_mapping.host_port}:{port_mapping.container_port or port_mapping.host_port} added successfully'
        )
    except Exception as e:
        logger.error(f"Failed to add port mapping: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@portmanager.post('/ports/remove', response_model=PortResponse)
async def remove_port_from_takserver(port_mapping: PortMappingRequest):
    """Remove a port mapping from the takserver service in the docker-compose.yml file"""
    try:
        # Remove the port from the docker-compose file
        DockerComposeEditor.remove_port_from_takserver(
            host_port=port_mapping.host_port,
            container_port=port_mapping.container_port
        )
        
        return PortResponse(
            status='success',
            message=f'Port mapping {port_mapping.host_port}:{port_mapping.container_port or port_mapping.host_port} removed successfully'
        )
    except Exception as e:
        logger.error(f"Failed to remove port mapping: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) 