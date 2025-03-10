# backend/routes/data_package_route.py

from fastapi import APIRouter, HTTPException, Request, File, UploadFile
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, List, Optional
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.config.logging_config import configure_logging
import json

logger = configure_logging(__name__)

# Router setup
datapackage = APIRouter()

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
    clientCert: Optional[str] = None  # Make clientCert optional for enrollment mode
    zipFileName: str
    customFiles: List[str]  # List of filenames to include
    enrollment: Optional[bool] = False  # Add enrollment flag with default False

@datapackage.post('/generate')
async def generate_package(request: Request, data: DataPackageRequest):
    """Generate a data package with the given preferences"""
    try:
        # Log raw request data
        raw_data = await request.json()
        logger.debug(f"[generate_package] Raw request data: {raw_data}")
        
        # Create DataPackage instance
        data_package = DataPackage()
        
        # Prepare preferences for package generation
        preferences = {
            'count': data.takServerConfig.count,
        }

        # Add configuration for each stream
        stream_count = int(data.takServerConfig.count)
        for i in range(stream_count):
            raw_config = raw_data['takServerConfig']
            preferences[f'description{i}'] = raw_config.get(f'description{i}', '')
            preferences[f'ipAddress{i}'] = raw_config.get(f'ipAddress{i}', '')
            preferences[f'port{i}'] = raw_config.get(f'port{i}', '')
            preferences[f'protocol{i}'] = raw_config.get(f'protocol{i}', '')
            preferences[f'caLocation{i}'] = raw_config.get(f'caLocation{i}', '')
            preferences[f'certPassword{i}'] = raw_config.get(f'certPassword{i}', '')
            
            # Only add client cert if not in enrollment mode
            if not data.enrollment and data.clientCert:
                preferences[f'certificateLocation{i}'] = data.clientCert
                preferences[f'clientPassword{i}'] = raw_config.get(f'certPassword{i}', '')
            
            preferences[f'caPassword{i}'] = raw_config.get(f'certPassword{i}', '')

        # Special fields for file naming
        preferences['#zip_file_name'] = data.zipFileName
        
        # Add ATAK preferences
        preferences.update(data.atakPreferences)

        # Add custom files list
        preferences['customFiles'] = data.customFiles

        # Add enrollment flag
        preferences['enrollment'] = data.enrollment

        # Execute package generation
        result = await data_package.main(preferences)
        
        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])
            
        return {
            'success': True,
            'path': result.get('path'),
            'message': 'Data package configuration completed successfully'
        }

    except ValidationError as e:
        logger.error(f"[generate_package] Validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[generate_package] Unhandled error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@datapackage.get('/certificate-files')
async def get_certificate_files():
    """Get available certificate files"""
    try:
        data_package = DataPackage()
        cert_files = await data_package.list_cert_files()
        return {
            'success': True,
            'files': cert_files
        }
    except Exception as e:
        logger.error(f"[get_certificate_files] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@datapackage.get('/custom-files')
async def get_custom_files():
    """Get list of uploaded custom files with metadata"""
    try:
        data_package = DataPackage()
        custom_files = await data_package.list_custom_files_with_metadata()
        return {'success': True, 'files': custom_files}
    except Exception as e:
        logger.error(f"[get_custom_files] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@datapackage.post('/custom-files')
async def upload_custom_file(file: UploadFile = File(...)):
    """Upload a custom file to be included in packages"""
    try:
        logger.info(f"Received custom file: {file.filename}")
        data_package = DataPackage()
        
        # Save the file
        await data_package.save_custom_file(file)
        
        logger.info(f"Custom file saved successfully: {file.filename}")
        return {'success': True, 'filename': file.filename, 'message': 'File uploaded successfully'}
    except Exception as e:
        logger.error(f"[upload_custom_file] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@datapackage.delete('/custom-files/{filename}')
async def delete_custom_file(filename: str):
    """Delete a custom file from the server"""
    try:
        data_package = DataPackage()
        await data_package.delete_custom_file(filename)
        return {'success': True}
    except Exception as e:
        logger.error(f"[delete_custom_file] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

