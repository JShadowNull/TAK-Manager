# backend/routes/data_package_route.py

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from backend.services.scripts.data_package_config.data_package import DataPackage
import uuid
import json
import os
from pathlib import Path
import logging
import time
import asyncio

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

# ============================================================================
# Router and Global Variables
# ============================================================================
datapackage = APIRouter()
configurations = {}

# Global state for SSE events
_latest_data_package_status: dict = {}

def emit_data_package_event(data: dict):
    """Update latest data package status state"""
    global _latest_data_package_status
    _latest_data_package_status = data

# ============================================================================
# Pydantic Models
# ============================================================================
class PreferencesData(BaseModel):
    preferences: Dict[str, Any]

class ConfigurationResponse(BaseModel):
    configuration_id: str
    message: str
    status: str = 'pending'

class StopRequest(BaseModel):
    configuration_id: str

# ============================================================================
# Helper Functions
# ============================================================================
async def execute_data_package_operation(operation_func) -> Dict[str, Any]:
    """Execute a data package operation asynchronously"""
    try:
        result = await operation_func()
        if result and result.get('error'):
            return {'success': False, 'message': result['error']}
        return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error in operation: {error_message}")
        return {
            'success': False,
            'message': error_message
        }

def normalize_preferences(preferences):
    """
    Normalize preferences data to ensure consistent format for multiple CoT streams.
    """
    normalized = {}
    stream_count = int(preferences.get('count', {}).get('value', 1))
    
    # Set count
    normalized['count'] = {'value': stream_count}
    
    # Preserve zip file name if present
    if '#zip_file_name' in preferences:
        normalized['#zip_file_name'] = preferences['#zip_file_name']
    
    # Base fields for each stream
    stream_fields = [
        'description',
        'enabled',
        'connectString',
        'caLocation',
        'certificateLocation',
        'clientPassword',
        'caPassword'
    ]
    
    # Process each stream
    for i in range(stream_count):
        # Preserve certificate markers for each stream
        cert_markers = [f'#ca_cert_name{i}', f'#client_cert_name{i}']
        for marker in cert_markers:
            if marker in preferences:
                normalized[marker] = preferences[marker]
        
        # Process regular fields
        for field in stream_fields:
            key = f"{field}{i}"
            if key in preferences:
                normalized[key] = preferences[key]
            else:
                # Set default values for missing fields
                if field == 'enabled':
                    normalized[key] = {'value': True}  # Default to enabled
                else:
                    normalized[key] = {'value': ''}
    
    return normalized

# ============================================================================
# Operation Handler
# ============================================================================
class DataPackageOperationHandler:
    def __init__(self, data_package_instance=None):
        self.data_package = data_package_instance or DataPackage(emit_event=emit_data_package_event)
        self.operation_in_progress = False

    async def handle_configuration(self, preferences_data):
        """Handle data package configuration process"""
        try:
            self.operation_in_progress = True
            return await asyncio.to_thread(self.data_package.main, preferences_data)
        except Exception as e:
            return {'error': str(e)}
        finally:
            self.operation_in_progress = False

    async def handle_stop(self):
        """Handle stopping the data package configuration"""
        try:
            await asyncio.to_thread(self.data_package.stop)
            return {'status': 'Configuration stopped successfully'}
        except Exception as e:
            return {'error': str(e)}

# ============================================================================
# Routes
# ============================================================================
@datapackage.get('/status-stream')
async def data_package_status_stream():
    """SSE endpoint for data package status updates."""
    data_package = DataPackage(emit_event=emit_data_package_event)
    return EventSourceResponse(data_package.status_generator())

@datapackage.post('/submit-preferences', response_model=ConfigurationResponse)
async def submit_preferences(preferences: Dict[str, Any]):
    """Submit preferences for data package configuration"""
    try:
        configuration_id = str(uuid.uuid4())
        data_package = DataPackage(emit_event=emit_data_package_event)
        handler = DataPackageOperationHandler(data_package)
        configurations[configuration_id] = handler

        operation_result = await execute_data_package_operation(
            lambda: handler.handle_configuration(preferences)
        )
        
        return ConfigurationResponse(
            configuration_id=configuration_id,
            message=operation_result.get('message', 'Configuration initiated'),
            status=operation_result.get('status', 'pending')
        )

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error processing request: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage.post('/stop')
async def stop_data_package(stop_request: StopRequest):
    """Stop data package configuration"""
    try:
        if stop_request.configuration_id not in configurations:
            raise HTTPException(status_code=404, detail="Invalid configuration ID")

        handler = configurations[stop_request.configuration_id]
        operation_result = await execute_data_package_operation(
            lambda: handler.handle_stop()
        )
        
        if operation_result['success']:
            del configurations[stop_request.configuration_id]
            
        return operation_result

    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error stopping configuration: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage.post('/save-preferences')
async def save_preferences(data: PreferencesData):
    """Save preferences to a temporary file"""
    try:
        if not data.preferences:
            raise HTTPException(status_code=400, detail="No preferences data provided")
            
        normalized_preferences = normalize_preferences(data.preferences)
        
        data_package = DataPackage(emit_event=emit_data_package_event)
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        prefs_file = temp_dir / 'data_package_preferences.json'
        async with asyncio.Lock():
            with open(prefs_file, 'w') as f:
                json.dump(normalized_preferences, f, indent=2)
        
        return {"message": "Preferences saved successfully"}
    except Exception as e:
        error_message = str(e)
        logger.error(f"Failed to save preferences: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage.get('/load-preferences')
async def load_preferences():
    """Load preferences from the temporary file"""
    try:
        data_package = DataPackage(emit_event=emit_data_package_event)
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        prefs_file = temp_dir / 'data_package_preferences.json'
        
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        if prefs_file.exists():
            try:
                async with asyncio.Lock():
                    with open(prefs_file, 'r') as f:
                        preferences = json.load(f)
                        normalized_preferences = normalize_preferences(preferences)
                return {"preferences": normalized_preferences}
            except json.JSONDecodeError:
                default_preferences = normalize_preferences({'count': {'value': 1}})
                return {"preferences": default_preferences}
        
        default_preferences = normalize_preferences({'count': {'value': 1}})
        return {"preferences": default_preferences}
    except Exception as e:
        error_message = str(e)
        logger.error(f"Failed to load preferences: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@datapackage.get('/certificate-files')
async def get_certificate_files():
    """Get available certificate files"""
    try:
        data_package = DataPackage(emit_event=emit_data_package_event)
        cert_files = await asyncio.to_thread(data_package.get_certificate_files)
        return {
            'success': True,
            'files': cert_files
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting certificate files: {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

