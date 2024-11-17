# Path: backend/routes/transfer_route.py


from flask import Blueprint, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
from backend.services.scripts.transfer.transfer import RapidFileTransfer
transfer_bp = Blueprint('transfer', __name__)
rapid_file_transfer = RapidFileTransfer()

@transfer_bp.route('/transfer')
def transfer_page():
    """Route to render the transfer management page"""
    return render_template('transfer/transfer.html')

@transfer_bp.route('/check_adb', methods=['GET'])
def check_adb():
    """Route to check if ADB is installed"""
    if rapid_file_transfer.check_adb_installed():
        return jsonify({'status': 'ADB is already installed'}), 200
    else:
        return jsonify({'status': 'ADB is not installed'}), 200

@transfer_bp.route('/install_adb', methods=['POST'])
def install_adb():
    """Route to install ADB if not installed"""    
    if not rapid_file_transfer.check_adb_installed():
        rapid_file_transfer.install_adb()
        return jsonify({'status': 'ADB installed successfully'}), 200
    else:
        return jsonify({'status': 'ADB is already installed'}), 200

@transfer_bp.route('/upload_file', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'error': 'No selected file'}), 400
        
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
            file.save(file_path)
            return jsonify({'status': 'success', 'message': f'File {filename} uploaded successfully'})
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


