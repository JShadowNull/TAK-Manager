# ============================================================================
# Imports
# ============================================================================
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from backend.services.scripts.cert_manager.certmanager import CertManager
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import logging
import time
import asyncio

# Configure logger
logger = logging.getLogger(__name__)

# ============================================================================
# Router and Global Variables
# ============================================================================
certmanager = APIRouter()

# Global state for SSE events
_latest_cert_status: dict = {}

def emit_cert_event(data: dict):
    """Update latest certificate status state"""
    global _latest_cert_status
    _latest_cert_status = data

cert_manager = CertManager(emit_event=emit_cert_event)

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

# ============================================================================
# File Monitoring
# ============================================================================
class CertificateChangeHandler(FileSystemEventHandler):
    def __init__(self, cert_manager):
        self.cert_manager = cert_manager
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.cert_manager.get_auth_file_path():
            try:
                # Get and send updated certificates
                certificates = self.cert_manager.get_registered_certificates()
                emit_cert_event({
                    'type': 'certificates_update',
                    'certificates': certificates,
                    'timestamp': time.time()
                })
            except Exception as e:
                logger.error(f"Error handling certificate file change: {e}")

def setup_certificate_monitoring():
    """Setup file monitoring for certificate changes"""
    try:
        auth_file = cert_manager.get_auth_file_path()
        event_handler = CertificateChangeHandler(cert_manager)
        observer = Observer()
        observer.schedule(event_handler, path=os.path.dirname(auth_file), recursive=False)
        observer.start()
        return observer
    except Exception as e:
        logger.error(f"Error setting up certificate monitoring: {e}")
        return None

# ============================================================================
# Helper Functions
# ============================================================================
async def execute_cert_operation(operation_func) -> Dict[str, Any]:
    """Execute a certificate operation asynchronously"""
    try:
        result = await operation_func()
        return result
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error in operation: {error_message}")
        return {
            'success': False,
            'message': error_message
        }

# ============================================================================
# Routes
# ============================================================================
@certmanager.get('/certificates/status-stream')
async def certificate_status_stream():
    """SSE endpoint for certificate status updates."""
    return EventSourceResponse(cert_manager.status_generator())

@certmanager.get('/certificates')
async def get_certificates():
    """Get all registered certificates"""
    try:
        certificates = await asyncio.to_thread(cert_manager.get_registered_certificates)
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
            is_valid, error = cert_manager.validate_batch_inputs(data.name, data.count, data.group)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error)
            
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
        result = await execute_cert_operation(
            lambda: asyncio.to_thread(cert_manager.create_batch, [cert.dict() for cert in certificates_to_create])
        )
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
        operation_func = (
            lambda: asyncio.to_thread(cert_manager.delete_main, data.usernames[0])
            if len(data.usernames) == 1
            else lambda: asyncio.to_thread(cert_manager.delete_batch, data.usernames)
        )

        return await execute_cert_operation(operation_func)

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting certificates: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

# Initialize certificate monitoring
observer = setup_certificate_monitoring()