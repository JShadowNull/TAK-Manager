# Path: backend/routes/transfer_route.py


from flask import Blueprint, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
from backend.services.scripts.transfer.transfer import RapidFileTransfer
transfer_bp = Blueprint('transfer', __name__, url_prefix='/api/transfer')
rapid_file_transfer = RapidFileTransfer()

@transfer_bp.route('/check_adb', methods=['GET'])
def check_adb():
    """Route to check if ADB is installed"""
    try:
        if rapid_file_transfer.check_adb_installed():
            return jsonify({
                'status': 'ADB is already installed',
                'success': True
            }), 200
        else:
            return jsonify({
                'status': 'ADB is not installed',
                'success': False
            }), 200
    except Exception as e:
        return jsonify({
            'status': f'Error checking ADB: {str(e)}',
            'success': False
        }), 500

@transfer_bp.route('/install_adb', methods=['POST'])
def install_adb():
    """Route to install ADB if not installed"""    
    try:
        if not rapid_file_transfer.check_adb_installed():
            success = rapid_file_transfer.install_adb()
            if success:
                return jsonify({
                    'status': 'ADB installed successfully',
                    'success': True
                }), 200
            else:
                return jsonify({
                    'status': 'Failed to install ADB',
                    'success': False
                }), 500
        else:
            return jsonify({
                'status': 'ADB is already installed',
                'success': True
            }), 200
    except Exception as e:
        return jsonify({
            'status': f'Error installing ADB: {str(e)}',
            'success': False
        }), 500

@transfer_bp.route('/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload to temporary directory"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'error': 'No file part'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'error': 'No selected file'
            }), 400
        
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
            
            # Ensure temp directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Save the file
            file.save(file_path)
            
            return jsonify({
                'status': 'success',
                'message': f'File {filename} uploaded successfully'
            }), 200
        
        return jsonify({
            'status': 'error',
            'error': 'Invalid file'
        }), 400
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@transfer_bp.route('/delete_file', methods=['POST'])
def delete_file():
    """Handle file deletion from temporary directory"""
    try:
        data = request.get_json()
        if not data or 'filename' not in data:
            return jsonify({
                'status': 'error',
                'error': 'No filename provided'
            }), 400
        
        filename = data['filename']
        file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({
                'status': 'error',
                'error': 'File not found'
            }), 404
            
        # Delete the file
        os.remove(file_path)
        
        return jsonify({
            'status': 'success',
            'message': f'File {filename} deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


