from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from backend.services.scripts.ota.ota_updates import OTAUpdate
from flask_sse import sse
import os
import uuid
import json
import logging
from backend.services.scripts.system.thread_manager import ThreadManager
import time
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
ota_bp = Blueprint('ota', __name__)

thread_manager = ThreadManager()
updates = {}

# ============================================================================
# Helper Functions
# ============================================================================
def allowed_file(filename):
    result = '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'
    logger.debug(f"File validation: {json.dumps({'filename': filename, 'is_allowed': result})}")
    return result

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    logger.debug(f"Upload path: {json.dumps({'path': upload_dir})}")
    return upload_dir

def process_ota_file(stream, filename):
    """Process and validate OTA file"""
    logger.debug("Processing OTA file")
    
    if not stream or not filename:
        logger.error("Empty stream or filename provided")
        raise ValueError("No file selected")
        
    if not allowed_file(filename):
        logger.error(f"Invalid file type: {json.dumps({'filename': filename})}")
        raise ValueError("Invalid file type. Please upload a ZIP file")

    # Get total size from content length
    total_size = request.content_length
    if not total_size or total_size <= 0:
        logger.error("Invalid content length")
        raise ValueError("Invalid file size")

    # Account for multipart form data overhead
    boundary_size = len(request.headers.get('Content-Type', '').split('boundary=')[-1]) + 8
    headers_size = 0
    for line in request.headers:
        headers_size += len(line) + 2
    
    file_size = total_size - (boundary_size * 2) - headers_size - 8

    logger.debug(f"File info: {json.dumps({'filename': filename, 'size': file_size})}")

    upload_dir = get_upload_path()
    filename = secure_filename(filename)
    file_path = os.path.join(upload_dir, filename)
    
    if os.path.exists(file_path):
        logger.debug(f"Removing existing file: {json.dumps({'path': file_path})}")
        os.remove(file_path)

    chunk_size = 1024 * 1024  # 1MB chunks
    bytes_written = 0
    last_progress = -1
    last_progress_time = time.time()
    
    logger.debug(f"Starting file save with params: {json.dumps({'chunk_size': chunk_size, 'total_size': file_size})}")
    
    try:
        logger.debug("Starting file save process...")
        with open(file_path, 'wb') as f:
            while bytes_written < file_size:
                chunk = stream.read(min(chunk_size, file_size - bytes_written))
                if not chunk:
                    break
                
                f.write(chunk)
                bytes_written += len(chunk)
                
                # Calculate progress
                progress = int((bytes_written / file_size) * 100)
                current_time = time.time()
                
                # Only emit progress every 0.5 seconds or when progress changes
                if (progress != last_progress and current_time - last_progress_time >= 0.5):
                    logger.debug(f"File save progress: {json.dumps({'progress': progress, 'bytes_written': bytes_written, 'total_size': file_size})}")
                    try:
                        sse.publish(
                            {
                                'status': 'in_progress',
                                'progress': progress,
                                'message': f'Saving file to disk: {progress}%',
                                'timestamp': time.time()
                            },
                            type='ota_status'
                        )
                        logger.debug(f"Progress event emitted: {json.dumps({'event': 'ota_status', 'progress': progress})}")
                    except Exception as e:
                        logger.error(f"Error emitting progress: {str(e)}")
                    
                    last_progress = progress
                    last_progress_time = current_time

        # Verify file size
        actual_size = os.path.getsize(file_path)
        if abs(actual_size - file_size) > 1024:  # Allow 1KB difference
            raise ValueError(f"File size mismatch. Expected ~{file_size} bytes but got {actual_size}")

        logger.debug(f"File save complete: {json.dumps({'path': file_path, 'final_size': actual_size})}")
        try:
            sse.publish(
                {
                    'status': 'completed',
                    'message': 'File saved successfully',
                    'progress': 100,
                    'timestamp': time.time()
                },
                type='ota_status'
            )
            logger.debug("File save complete event emitted")
        except Exception as e:
            logger.error(f"Error emitting complete event: {str(e)}")
        return file_path
        
    except Exception as e:
        error_msg = f"Error saving file: {str(e)}"
        logger.error(error_msg)
        try:
            sse.publish(
                {
                    'status': 'error',
                    'message': error_msg,
                    'error': str(e),
                    'timestamp': time.time()
                },
                type='ota_status'
            )
            logger.debug(f"Error event emitted: {json.dumps({'error': error_msg})}")
        except Exception as emit_error:
            logger.error(f"Error emitting error event: {str(emit_error)}")
        if os.path.exists(file_path):
            os.remove(file_path)
        raise

# ============================================================================
# HTTP Routes
# ============================================================================
@ota_bp.route('/ota-configure', methods=['POST'])
def configure_ota():
    """Handle initial OTA configuration"""
    logger.debug("Received OTA configuration request")
    try:
        # Get content length early
        content_length = request.content_length
        if not content_length:
            error_response = {
                'success': False,
                'error': 'Content-Length header is required',
                'status': 'error'
            }
            logger.error("No content length in request")
            return jsonify(error_response), 400

        # Access stream directly
        stream = request.stream
        boundary = request.headers.get('Content-Type', '').split('boundary=')[-1]
        if not boundary:
            error_response = {
                'success': False,
                'error': 'Multipart boundary not found',
                'status': 'error'
            }
            logger.error("No multipart boundary in request")
            return jsonify(error_response), 400

        # Read the multipart headers to get filename
        logger.debug("Reading multipart headers")
        headers = []
        while True:
            line = stream.readline().decode('utf-8').strip()
            if not line:
                break
            headers.append(line)
            if 'filename=' in line:
                filename = line.split('filename=')[-1].strip('"')
                logger.debug(f"Found filename: {filename}")
                break

        if not filename:
            error_response = {
                'success': False,
                'error': 'No filename found in request',
                'status': 'error'
            }
            logger.error("No filename in request")
            return jsonify(error_response), 400

        if not allowed_file(filename):
            error_response = {
                'success': False,
                'error': 'Invalid file type. Please upload a ZIP file',
                'status': 'error'
            }
            logger.error(f"Invalid file type: {filename}")
            return jsonify(error_response), 400

        # Generate update ID
        update_id = str(uuid.uuid4())
        logger.debug(f"Generated update ID: {update_id}")

        # Process the file stream
        try:
            logger.debug(f"Processing file stream: {filename}")
            file_path = process_ota_file(stream, filename)
            logger.debug(f"File processed successfully: {file_path}")
        except Exception as e:
            logger.error(f"File processing failed: {str(e)}")
            raise

        # Start configuration in background
        def configure_task():
            try:
                logger.debug(f"Starting configuration task for update ID: {update_id}")
                ota_updater = OTAUpdate(file_path)
                updates[update_id] = ota_updater
                
                logger.debug("Running OTA configuration")
                success = ota_updater.main()
                logger.debug(f"Configuration completed with result: {success}")
                
                # Log final progress state
                final_progress = ota_updater.get_progress()
                logger.debug(f"Final configuration progress state: {json.dumps(final_progress)}")
                
                if success and os.path.exists(file_path):
                    logger.debug(f"Removing temporary file: {file_path}")
                    os.remove(file_path)
                return success
            except Exception as e:
                logger.error(f"Configuration task error: {json.dumps({'error': str(e)})}")
                try:
                    error_progress = ota_updater.get_progress()
                    logger.debug(f"Progress state at error: {json.dumps(error_progress)}")
                except Exception as pe:
                    logger.error(f"Failed to get progress during error: {str(pe)}")
                sse.publish(
                    {
                        'status': 'error',
                        'message': str(e),
                        'error': str(e),
                        'timestamp': time.time()
                    },
                    type='ota_status'
                )
                return False
            finally:
                if update_id in updates:
                    logger.debug(f"Cleaning up update ID: {update_id}")
                    del updates[update_id]

        # Start the configuration task
        logger.debug("Spawning configuration task")
        thread_manager.spawn(configure_task)

        # Return success response
        response = {
            'success': True,
            'update_id': update_id,
            'message': 'File upload started, beginning configuration...',
            'status': 'processing'
        }
        logger.debug(f"OTA configuration initiated: {json.dumps(response)}")
        return jsonify(response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error'
        }
        logger.error(f"OTA configuration exception: {json.dumps(error_response)}")
        return jsonify(error_response), 500

@ota_bp.route('/ota-update', methods=['POST'])
def update_ota():
    """Handle OTA plugin updates"""
    logger.debug("Received OTA update request")
    try:
        try:
            file_path = process_ota_file(request)
        except ValueError as e:
            error_response = {
                'success': False,
                'error': str(e),
                'status': 'error'
            }
            logger.error(f"OTA update error: {json.dumps(error_response)}")
            return jsonify(error_response), 400

        update_id = str(uuid.uuid4())
        ota_updater = OTAUpdate(file_path)
        updates[update_id] = ota_updater

        def update_task():
            try:
                success = ota_updater.update()
                logger.debug(f"Update task result: {json.dumps({'success': success})}")
                if success:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                return success
            except Exception as e:
                logger.error(f"Update task error: {json.dumps({'error': str(e)})}")
                current_app.logger.error(f"Update error: {str(e)}")
                return False
            finally:
                if update_id in updates:
                    del updates[update_id]

        thread = thread_manager.spawn(update_task)
        response = {
            'success': True,
            'update_id': update_id,
            'message': 'OTA update initiated',
            'status': 'pending',
            'progress': 0
        }
        logger.debug(f"OTA update initiated: {json.dumps(response)}")
        return jsonify(response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error'
        }
        logger.error(f"OTA update exception: {json.dumps(error_response)}")
        return jsonify(error_response), 500

@ota_bp.route('/ota-update-progress/<update_id>', methods=['GET'])
def get_update_progress(update_id):
    """Get progress of current OTA update or configuration"""
    logger.debug(f"Progress check requested for update ID: {update_id}")
    try:
        updater = updates.get(update_id)
        if not updater:
            error_response = {
                'success': False,
                'error': 'Update not found',
                'status': 'not_found',
                'progress': 0
            }
            logger.error(f"Update not found: {update_id}")
            return jsonify(error_response), 404

        logger.debug(f"Found updater for ID: {update_id}")
        progress_info = updater.get_progress()
        logger.debug(f"Raw progress info: {json.dumps(progress_info)}")
        
        status = progress_info.get('status', 'idle')
        progress = progress_info.get('progress', 0)
        message = progress_info.get('message', '')

        logger.debug(f"Progress info: {json.dumps({'update_id': update_id, 'status': status, 'progress': progress, 'message': message})}")

        response = {
            'success': True,
            'status': status,
            'progress': progress,
            'message': message
        }

        if status == 'complete':
            logger.debug(f"Update {update_id} completed successfully")
            response['message'] = 'Operation completed successfully'
        elif status == 'error':
            error = progress_info.get('error', 'Unknown error occurred')
            logger.error(f"Update {update_id} failed: {error}")
            response.update({
                'success': False,
                'error': error
            })

        logger.debug(f"Progress response: {json.dumps(response)}")
        return jsonify(response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error',
            'progress': 0
        }
        logger.error(f"Progress check failed for update {update_id}: {str(e)}")
        return jsonify(error_response), 500