# backend/routes/data_package_route.py

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, AsyncGenerator, List
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.config.logging_config import configure_logging
import json
import asyncio

logger = configure_logging(__name__)

# Router setup
datapackage = APIRouter()

# Global state for SSE events
_latest_package_status: Dict[str, Any] = {}
_total_packages = 0
_current_package = 0

# Pydantic Models
class TakServerConfig(BaseModel):
    count: str
    description0: str
    ipAddress0: str
    port0: str
    protocol0: str
    caLocation0: str
    certPassword0: str

class DataPackageRequest(BaseModel):
    takServerConfig: TakServerConfig
    atakPreferences: Dict[str, Any]
    clientCert: str
    zipFileName: str
    totalPackages: int = 1  # Default to 1 if not specified

async def package_status_generator() -> AsyncGenerator[Dict[str, Any], None]:
    """Generate package generation status events."""
    last_status = None
    while True:
        if _latest_package_status and _latest_package_status != last_status:
            # Calculate overall progress
            if _total_packages > 0:
                package_progress = _latest_package_status.get('progress', 0)
                # Calculate progress as: (completed_packages * 100 + current_package_progress) / total_packages
                overall_progress = min(100, (_current_package * 100 + package_progress) / _total_packages)
                
                # Update the status with overall progress
                status_data = _latest_package_status.copy()
                status_data['progress'] = overall_progress
                if _current_package < _total_packages - 1 or status_data['status'] != 'complete':
                    status_data['message'] = f"Package {_current_package + 1} of {_total_packages}: {status_data['message']}"
                
                event_data = {
                    "event": "package-status",
                    "data": json.dumps(status_data)
                }
                logger.debug(f"Sending package status SSE: {event_data}")
                last_status = _latest_package_status.copy()
                yield event_data
        await asyncio.sleep(0.1)  # Check every 100ms

@datapackage.get('/generate-status-stream')
async def generate_status_stream():
    """SSE endpoint for package generation status."""
    return EventSourceResponse(package_status_generator())

@datapackage.post('/generate')
async def generate_package(request: Request, data: DataPackageRequest):
    """Generate a data package with the given preferences"""
    try:
        # Log raw request data
        raw_data = await request.json()
        logger.debug(f"[generate_package] Raw request data: {raw_data}")
        logger.debug(f"[generate_package] Validated request data: {data.dict()}")
        
        # Log individual components
        logger.debug(f"[generate_package] TAK Server Config: {data.takServerConfig}")
        logger.debug(f"[generate_package] ATAK Preferences: {data.atakPreferences}")
        logger.debug(f"[generate_package] Client Cert: {data.clientCert}")
        logger.debug(f"[generate_package] Zip File Name: {data.zipFileName}")
        
        # Update global package counters
        global _total_packages, _current_package
        _total_packages = data.totalPackages
        _current_package = 0
        
        # Create DataPackage with event emitter
        async def emit_event(event_data: Dict[str, Any]):
            global _latest_package_status
            if _latest_package_status != event_data:  # Only emit if the data has changed
                _latest_package_status = event_data
                logger.debug(f"Emitting package status event: {event_data}")
        
        data_package = DataPackage(emit_event=emit_event)

        # Prepare preferences for package generation
        try:
            preferences = {
                # TAK server configuration - include all streams
                'count': data.takServerConfig.count,
            }

            # Add configuration for each stream
            stream_count = int(data.takServerConfig.count)
            for i in range(stream_count):
                # Get all fields from the raw data since pydantic model may not capture all fields
                raw_config = raw_data['takServerConfig']
                preferences[f'description{i}'] = raw_config.get(f'description{i}', '')
                preferences[f'ipAddress{i}'] = raw_config.get(f'ipAddress{i}', '')
                preferences[f'port{i}'] = raw_config.get(f'port{i}', '')
                preferences[f'protocol{i}'] = raw_config.get(f'protocol{i}', '')
                preferences[f'caLocation{i}'] = raw_config.get(f'caLocation{i}', '')
                preferences[f'certPassword{i}'] = raw_config.get(f'certPassword{i}', '')
                preferences[f'certificateLocation{i}'] = data.clientCert
                preferences[f'clientPassword{i}'] = raw_config.get(f'certPassword{i}', '')
                preferences[f'caPassword{i}'] = raw_config.get(f'certPassword{i}', '')

            # Special fields for file naming
            preferences['#zip_file_name'] = data.zipFileName
            
            logger.debug(f"[generate_package] Base preferences created: {preferences}")
            
            # Add ATAK preferences
            logger.debug(f"[generate_package] Adding ATAK preferences: {data.atakPreferences}")
            preferences.update(data.atakPreferences)

            logger.debug(f"[generate_package] Final preferences: {preferences}")
            
            result = await data_package.main(preferences)
            logger.debug(f"[generate_package] Package generation result: {result}")
            
            # Update package counter after successful generation
            _current_package += 1
            
            return {"status": "Data package configuration completed successfully"}
            
        except ValidationError as e:
            error_msg = str(e)
            logger.error(f"[generate_package] Validation error: {error_msg}")
            raise HTTPException(status_code=422, detail=error_msg)
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[generate_package] Error preparing preferences: {error_msg}")
            raise HTTPException(status_code=422, detail=error_msg)
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[generate_package] Unhandled error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@datapackage.get('/certificate-files')
async def get_certificate_files():
    """Get available certificate files"""
    try:
        logger.debug("[get_certificate_files] Starting certificate file retrieval")
        data_package = DataPackage()
        cert_files = await data_package.list_cert_files()  # Updated to use the new script method
        logger.debug(f"[get_certificate_files] Found certificate files: {cert_files}")
        return {
            'success': True,
            'files': cert_files
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"[get_certificate_files] Error: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

