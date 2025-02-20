# backend/routes/data_package_route.py

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ValidationError
from typing import Dict, Any
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
    clientCert: str
    zipFileName: str

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
            preferences[f'certificateLocation{i}'] = data.clientCert
            preferences[f'clientPassword{i}'] = raw_config.get(f'certPassword{i}', '')
            preferences[f'caPassword{i}'] = raw_config.get(f'certPassword{i}', '')

        # Special fields for file naming
        preferences['#zip_file_name'] = data.zipFileName
        
        # Add ATAK preferences
        preferences.update(data.atakPreferences)

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

