# ============================================================================
# Imports
# ============================================================================
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from backend.services.scripts.cert_manager.certmanager import CertManager
from backend.services.scripts.cert_manager.cert_xml_editor import CertConfigManager
from backend.config.logging_config import configure_logging

# Configure logger
logger = configure_logging(__name__)

# ============================================================================
# Router and Global Variables
# ============================================================================
certmanager = APIRouter()
cert_manager = CertManager()
cert_config_manager = CertConfigManager()

# ============================================================================
# Pydantic Models
# ============================================================================
class Certificate(BaseModel):
    username: str
    groups: List[str] = Field(default_factory=list)
    is_admin: bool = False
    password: Optional[str] = None

class BatchCreateRequest(BaseModel):
    name: Optional[str] = None
    count: Optional[int] = 1
    group: Optional[str] = "__ANON__"
    prefixType: Optional[str] = "numeric"
    isAdmin: Optional[bool] = False
    startAt: Optional[str] = "1"
    certificates: Optional[List[Certificate]] = None

class DeleteRequest(BaseModel):
    usernames: List[str]

class DownloadRequest(BaseModel):
    usernames: List[str]

class CertConfigRequest(BaseModel):
    content: str

class PasswordHashRequest(BaseModel):
    password: str

# ============================================================================
# Routes
# ============================================================================
@certmanager.get('/certificates')
async def get_certificates():
    """Get all registered certificates"""
    try:
        certificates = await cert_manager.get_registered_certificates()
        return {
            'success': True,
            'certificates': certificates
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@certmanager.post('/certificates/create')
async def create_certificates(data: BatchCreateRequest):
    """Create certificates - supports both single and batch operations"""
    try:
        # If certificates are provided directly, use them
        if data.certificates:
            certificates_to_create = data.certificates
        # Handle batch mode with name prefix
        elif data.name is not None:
            certificates_to_create = []
            # The frontend now handles the certificate name generation
            # We just need to process the provided certificates
            if data.certificates:
                certificates_to_create = data.certificates
            else:
                # Fallback to old behavior if no certificates provided
                for i in range(data.count):
                    suffix = chr(97 + i) if data.prefixType == 'alpha' else str(i + 1)
                    cert_name = f"{data.name}-{data.group}-{suffix}"
                    certificates_to_create.append(Certificate(
                        username=cert_name,
                        groups=[data.group],
                        is_admin=data.isAdmin,
                        password=None
                    ))
        else:
            raise HTTPException(status_code=400, detail="Either name or certificates must be provided")

        # Execute the operation
        result = await cert_manager.create_main([cert.dict() for cert in certificates_to_create])
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@certmanager.delete('/certificates/delete')
async def delete_certificates(data: DeleteRequest):
    """Delete certificates - supports both single and batch deletions"""
    try:
        if not data.usernames:
            raise HTTPException(status_code=400, detail="Usernames list is empty")

        # Execute the deletion operation
        if len(data.usernames) == 1:
            result = await cert_manager.delete_main(data.usernames[0])
            if not result:
                raise HTTPException(status_code=404, detail="Certificate not found")
        else:
            result = await cert_manager.delete_batch(data.usernames)
            if not result:
                raise HTTPException(status_code=404, detail="No certificates were deleted")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@certmanager.post('/certificates/download')
async def download_certificates(data: DownloadRequest):
    """Download certificates - supports both browser and pywebview"""
    try:
        if not data.usernames:
            raise HTTPException(status_code=400, detail="Usernames list is empty")

        if len(data.usernames) == 1:
            username = data.usernames[0]
            result = await cert_manager.download_single(username)
            if not result.get('success'):
                raise HTTPException(status_code=404, detail=result.get('message', "Certificate not found"))
            
            # Return as bytes directly
            return StreamingResponse(
                iter([result['data']]),  # Keep as bytes iterator
                media_type='application/octet-stream',
                headers={'Content-Disposition': f'attachment; filename="{result["filename"]}"'}
            )

        # Handle batch downloads
        result = await cert_manager.download_batch(data.usernames)
        if not result.get('success'):
            raise HTTPException(status_code=404, detail=result.get('message'))
        
        # Return first successful certificate
        for cert_result in result.get('results', []):
            if cert_result.get('status') == 'completed' and cert_result.get('data'):
                return StreamingResponse(
                    iter([cert_result['data']]),
                    media_type='application/octet-stream',
                    headers={
                        'Content-Disposition': f'attachment; filename="{cert_result["filename"]}"'
                    }
                )
        raise HTTPException(status_code=404, detail="No certificates were successfully downloaded")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Certificate XML Editor Routes
@certmanager.get("/certificates/{identifier}/config")
async def get_cert_config(identifier: str) -> Dict[str, Any]:
    """Get the XML configuration for a specific certificate"""
    try:
        content = cert_config_manager.read_cert_config(identifier)
        return {"success": True, "content": content}
    except Exception as e:
        logger.error(f"Error reading certificate config: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@certmanager.post("/certificates/{identifier}/config")
async def update_cert_config(identifier: str, request: CertConfigRequest) -> Dict[str, Any]:
    """Update the XML configuration for a specific certificate"""
    try:
        cert_config_manager.update_cert_config(identifier, request.content)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error updating certificate config: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@certmanager.post("/certificates/{identifier}/validate")
async def validate_cert_config(identifier: str, request: CertConfigRequest) -> Dict[str, Any]:
    """Validate the XML configuration for a specific certificate"""
    try:
        is_valid, error_msg = cert_config_manager.validate_cert_config(request.content, identifier)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        return {"valid": is_valid}
    except Exception as e:
        logger.error(f"Error validating certificate config: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@certmanager.post("/certificates/generate-password-hash")
async def generate_password_hash(request: PasswordHashRequest):
    """Generate a password hash for XML configuration"""
    try:
        hashed = cert_config_manager.generate_password_hash(request.password)
        return {"success": True, "hash": hashed}
    except Exception as e:
        logger.error(f"Password hash generation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))