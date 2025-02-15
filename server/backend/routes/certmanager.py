from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from ..services.scripts.takserver.cert_xml_editor import CertConfigManager

router = APIRouter()
cert_config_manager = CertConfigManager()

class CertConfigRequest(BaseModel):
    content: str

@router.get("/certificates/{identifier}/config")
async def get_cert_config(identifier: str) -> Dict[str, Any]:
    """Get the XML configuration for a specific certificate"""
    try:
        content = cert_config_manager.read_cert_config(identifier)
        return {"success": True, "content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/certificates/{identifier}/config")
async def update_cert_config(identifier: str, request: CertConfigRequest) -> Dict[str, Any]:
    """Update the XML configuration for a specific certificate"""
    try:
        cert_config_manager.update_cert_config(identifier, request.content)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/certificates/{identifier}/validate")
async def validate_cert_config(identifier: str, request: CertConfigRequest) -> Dict[str, Any]:
    """Validate the XML configuration for a specific certificate"""
    try:
        is_valid = cert_config_manager.validate_cert_config(request.content)
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 