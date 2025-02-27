from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.scripts.takserver.core_config import CoreConfigManager
from ..services.scripts.system.log_manager import LogManager
from sse_starlette.sse import EventSourceResponse
import os
from backend.config.logging_config import configure_logging

# Setup logging
logger = configure_logging(__name__)

# Create router
advanced_features = APIRouter()
core_config_manager = CoreConfigManager()
log_manager = LogManager()

@advanced_features.get("/takserver/logs")
async def stream_logs():
    """Stream TAK Server container logs"""
    logger.debug("Streaming TAK Server container logs")
    return EventSourceResponse(log_manager.stream_logs())

@advanced_features.get("/takserver/logs/list")
async def list_logs():
    """Get list of available log files"""
    try:
        logger.debug("Getting list of available log files")
        logs = log_manager.get_available_logs()
        return {"logs": logs}
    except Exception as e:
        logger.error(f"Error getting log files list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.get("/takserver/logs/{log_file}")
async def stream_log(log_file: str):
    """Stream a specific log file"""
    try:
        logger.debug(f"Streaming log file: {log_file}")
        return EventSourceResponse(log_manager.stream_log_file(log_file))
    except Exception as e:
        logger.error(f"Error streaming log file {log_file}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        logger.debug("Reading CoreConfig.xml content")
        content = core_config_manager.read_config()
        return {"content": content}
    except Exception as e:
        logger.error(f"Error reading CoreConfig.xml: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config")
async def update_core_config(xml_content: XMLContent):
    """Update the contents of CoreConfig.xml"""
    try:
        if not xml_content.content:
            logger.warning("Empty content provided for CoreConfig.xml update")
            raise HTTPException(status_code=400, detail="No content provided")
            
        logger.info("Updating CoreConfig.xml")
        # Validate and write the config
        if core_config_manager.write_config(xml_content.content):
            logger.info("CoreConfig.xml updated successfully")
            return {"message": "Configuration updated successfully"}
        logger.error("Failed to update CoreConfig.xml")
        raise HTTPException(status_code=500, detail="Failed to update configuration")
    except Exception as e:
        logger.error(f"Error updating CoreConfig.xml: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/validate")
async def validate_config(xml_content: XMLContent):
    """Validate XML content without saving"""
    try:
        if not xml_content.content:
            logger.warning("Empty content provided for XML validation")
            raise HTTPException(status_code=400, detail="No content provided")
            
        logger.debug("Validating XML content")
        if core_config_manager.validate_xml(xml_content.content):
            logger.debug("XML content is valid")
            return {"valid": True}
    except Exception as e:
        logger.warning(f"XML validation failed: {str(e)}")
        return {"valid": False, "error": str(e)}

@advanced_features.get("/core-config/backups")
async def get_backups():
    """Get list of all backups"""
    try:
        logger.debug("Getting list of CoreConfig backups")
        backups = core_config_manager.get_backups()
        return {"backups": backups}
    except Exception as e:
        logger.error(f"Error getting CoreConfig backups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/backups")
async def create_backup(backup: BackupCreate):
    """Create a new backup"""
    try:
        logger.info(f"Creating CoreConfig backup with name: {backup.name}")
        backup_info = core_config_manager.create_backup(backup.name)
        logger.info(f"CoreConfig backup created: {backup_info}")
        return backup_info
    except Exception as e:
        logger.error(f"Error creating CoreConfig backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.post("/core-config/backups/restore")
async def restore_backup(backup: BackupRestore):
    """Restore from a backup"""
    try:
        logger.info(f"Restoring CoreConfig from backup: {backup.backup_id}")
        if core_config_manager.restore_backup(backup.backup_id):
            logger.info("CoreConfig restored successfully")
            return {"message": "Configuration restored successfully"}
        logger.error(f"Failed to restore CoreConfig from backup: {backup.backup_id}")
        raise HTTPException(status_code=500, detail="Failed to restore configuration")
    except Exception as e:
        logger.error(f"Error restoring CoreConfig from backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.delete("/core-config/backups/{backup_id}")
async def delete_backup(backup_id: str):
    """Delete a backup"""
    try:
        logger.info(f"Deleting CoreConfig backup: {backup_id}")
        if core_config_manager.delete_backup(backup_id):
            logger.info(f"CoreConfig backup deleted: {backup_id}")
            return {"message": "Backup deleted successfully"}
        logger.error(f"Failed to delete CoreConfig backup: {backup_id}")
        raise HTTPException(status_code=500, detail="Failed to delete backup")
    except Exception as e:
        logger.error(f"Error deleting CoreConfig backup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@advanced_features.get("/core-config/backups/{backup_id}/content")
async def get_backup_content(backup_id: str):
    """Get the content of a specific backup"""
    try:
        logger.debug(f"Getting content of CoreConfig backup: {backup_id}")
        backup_path = os.path.join(core_config_manager.backups_dir, backup_id)
        if not os.path.exists(backup_path):
            logger.warning(f"CoreConfig backup not found: {backup_id}")
            raise HTTPException(status_code=404, detail="Backup not found")
            
        with open(backup_path, 'r') as file:
            content = file.read()
        return {"content": content}
    except Exception as e:
        logger.error(f"Error getting CoreConfig backup content: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 