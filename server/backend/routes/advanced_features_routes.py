from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.scripts.takserver.core_config import CoreConfigManager
import os

# Create router
advanced_features = APIRouter()
core_config_manager = CoreConfigManager()

class XMLContent(BaseModel):
    content: str

class BackupCreate(BaseModel):
    name: str = ""

class BackupRestore(BaseModel):
    backup_id: str

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

@advanced_features.get("/core-config/backups")
async def get_backups():
    """Get list of all backups"""
    try:
        backups = core_config_manager.get_backups()
        return {"backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/backups")
async def create_backup(backup: BackupCreate):
    """Create a new backup"""
    try:
        backup_info = core_config_manager.create_backup(backup.name)
        return backup_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/backups/restore")
async def restore_backup(backup: BackupRestore):
    """Restore from a backup"""
    try:
        if core_config_manager.restore_backup(backup.backup_id):
            return {"message": "Configuration restored successfully"}
        raise HTTPException(status_code=500, detail="Failed to restore configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.delete("/core-config/backups/{backup_id}")
async def delete_backup(backup_id: str):
    """Delete a backup"""
    try:
        if core_config_manager.delete_backup(backup_id):
            return {"message": "Backup deleted successfully"}
        raise HTTPException(status_code=500, detail="Failed to delete backup")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.get("/core-config/backups/{backup_id}/content")
async def get_backup_content(backup_id: str):
    """Get the content of a specific backup"""
    try:
        backup_path = os.path.join(core_config_manager.backups_dir, backup_id)
        if not os.path.exists(backup_path):
            raise HTTPException(status_code=404, detail="Backup not found")
            
        with open(backup_path, 'r') as file:
            content = file.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 