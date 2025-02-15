from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.scripts.takserver.core_config import CoreConfigManager

# Create router
advanced_features = APIRouter()
core_config_manager = CoreConfigManager()

class XMLContent(BaseModel):
    content: str

@advanced_features.get("/core-config")
async def get_core_config():
    """Get the contents of CoreConfig.xml"""
    try:
        content = core_config_manager.read_config()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config")
async def update_core_config(xml_content: XMLContent):
    """Update the contents of CoreConfig.xml"""
    try:
        if not xml_content.content:
            raise HTTPException(status_code=400, detail="No content provided")
            
        # Validate and write the config
        if core_config_manager.write_config(xml_content.content):
            return {"message": "Configuration updated successfully"}
        raise HTTPException(status_code=500, detail="Failed to update configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/validate")
async def validate_config(xml_content: XMLContent):
    """Validate XML content without saving"""
    try:
        if not xml_content.content:
            raise HTTPException(status_code=400, detail="No content provided")
            
        if core_config_manager.validate_xml(xml_content.content):
            return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)} 