# ============================================================================
# Imports
# ============================================================================
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, AsyncGenerator
from backend.services.scripts.cert_manager.certmanager import CertManager
import json
import asyncio
from backend.config.logging_config import configure_logging
import os

# Configure logger
logger = configure_logging(__name__)

# ============================================================================
# Router and Global Variables
# ============================================================================
certmanager = APIRouter()

# Global state for SSE events
_latest_cert_status: Dict[str, Any] = {}

async def emit_event(data: Dict[str, Any]):
    """Update latest certificate status state"""
    global _latest_cert_status
    if _latest_cert_status != data:  # Only emit if data has changed
        _latest_cert_status = data

cert_manager = CertManager(emit_event=emit_event)

# ============================================================================
# Pydantic Models
# ============================================================================
class Certificate(BaseModel):
    username: str
    groups: List[str] = Field(default_factory=list)
    is_admin: bool = False

class BatchCreateRequest(BaseModel):
    name: Optional[str] = None
    count: Optional[int] = 1
    group: Optional[str] = "__ANON__"
    prefixType: Optional[str] = "numeric"
    isAdmin: Optional[bool] = False
    certificates: Optional[List[Certificate]] = None

class DeleteRequest(BaseModel):
    usernames: List[str]

class DownloadRequest(BaseModel):
    usernames: List[str]

# ============================================================================
# Routes
# ============================================================================
@certmanager.get('/certificates/status-stream')
async def certificate_status_stream():
    """SSE endpoint for certificate status updates."""
    async def generate() -> AsyncGenerator[Dict[str, Any], None]:
        last_status = None
        while True:
            if _latest_cert_status and _latest_cert_status != last_status:
                event_data = {
                    "event": "certificate-status",
                    "data": json.dumps(_latest_cert_status)
                }
                logger.debug(f"Sending certificate status SSE: {event_data}")
                last_status = _latest_cert_status.copy()
                yield event_data
            await asyncio.sleep(0.1)  # Check every 100ms for more responsive updates

    # Start certificate monitoring when stream is connected
    await cert_manager.start_monitoring()
    try:
        return EventSourceResponse(generate())
    finally:
        # Stop monitoring when stream is disconnected
        await cert_manager.stop_monitoring()

@certmanager.get('/certificates')
async def get_certificates():
    """Get all registered certificates"""
    try:
        certificates = await cert_manager.get_registered_certificates()
        return {
            'success': True,
            'certificates': certificates
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting certificates: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@certmanager.post('/certificates/create')
async def create_certificates(data: BatchCreateRequest):
    """Create certificates - supports both single and batch operations"""
    try:
        certificates_to_create = []

        # Handle batch mode with name prefix
        if data.name is not None:
            for i in range(data.count):
                suffix = chr(97 + i) if data.prefixType == 'alpha' else str(i + 1)
                cert_name = f"{data.name}-{data.group}-{suffix}"
                certificates_to_create.append(Certificate(
                    username=cert_name,
                    groups=[data.group],
                    is_admin=data.isAdmin
                ))
        else:
            if not data.certificates:
                raise HTTPException(status_code=400, detail="Either name or certificates must be provided")
            certificates_to_create = data.certificates

        # Execute the operation
        result = await cert_manager.create_batch([cert.dict() for cert in certificates_to_create])
        return result

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error creating certificates: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@certmanager.delete('/certificates/delete')
async def delete_certificates(data: DeleteRequest):
    """Delete certificates - supports both single and batch deletions"""
    try:
        if not data.usernames:
            raise HTTPException(status_code=400, detail="Usernames list is empty")

        # Execute the deletion operation
        if len(data.usernames) == 1:
            return await cert_manager.delete_main(data.usernames[0])
        else:
            return await cert_manager.delete_batch(data.usernames)

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting certificates: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@certmanager.post('/certificates/download')
async def download_certificates(data: DownloadRequest):
    """Download certificates - supports both single and batch downloads"""
    try:
        if not data.usernames:
            raise HTTPException(status_code=400, detail="Usernames list is empty")

        # Execute the download operation
        if len(data.usernames) == 1:
            result = await cert_manager.get_certificate_files(data.usernames[0])
            if result['success']:
                return FileResponse(
                    result['files']['p12'],
                    filename=f"{data.usernames[0]}.p12",
                    media_type='application/x-pkcs12'
                )
            raise HTTPException(status_code=404, detail=result['message'])
        else:
            # For batch downloads, we'll still process one at a time but emit events
            result = await cert_manager.download_batch(data.usernames)
            if not result['success']:
                raise HTTPException(status_code=404, detail=result['message'])
            
            # Return the first successful download
            for cert_result in result['results']:
                if cert_result['status'] == 'completed' and cert_result.get('file_path'):
                    return FileResponse(
                        cert_result['file_path'],
                        filename=f"{cert_result['username']}.p12",
                        media_type='application/x-pkcs12'
                    )
            raise HTTPException(status_code=404, detail="No certificates were successfully downloaded")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))