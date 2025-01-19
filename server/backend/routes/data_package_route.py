# backend/routes/data_package_route.py

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Dict, Any
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

# Router setup
datapackage = APIRouter()

# Pydantic Models
class PreferencesData(BaseModel):
    preferences: Dict[str, Any]

@datapackage.get('/certificate-stream')
async def certificate_status_stream():
    """SSE endpoint for certificate list updates."""
    data_package = DataPackage()
    return EventSourceResponse(data_package.certificate_monitor())

@datapackage.post('/create-package')
async def create_package(preferences: PreferencesData):
    """Create a data package with the given preferences"""
    try:
        data_package = DataPackage()
        result = await data_package.main(preferences.preferences)
        return result
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error creating data package: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage.get('/certificate-files')
async def get_certificate_files():
    """Get available certificate files"""
    try:
        data_package = DataPackage()
        version = await data_package.read_version_txt()
        if version:
            container_name = f"takserver-{version}"
            cert_files = await data_package.list_cert_files(container_name)
            return {
                'success': True,
                'files': cert_files
            }
        return {
            'success': True,
            'files': []
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting certificate files: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

