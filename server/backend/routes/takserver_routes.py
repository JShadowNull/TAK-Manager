from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
import os
from backend.config.logging_config import configure_logging
from flask_sse import sse

# Setup basic logging
logger = configure_logging(__name__)

# Blueprint setup
takserver_bp = Blueprint('takserver', __name__)
status_checker = TakServerStatus()

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    try:
        if 'docker_zip_file' not in request.files:
            return '', 400

        file = request.files['docker_zip_file']
        if file.filename == '':
            return '', 400

        # Save file
        upload_dir = get_upload_path()
        filename = secure_filename(file.filename)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)

        # Create installer
        installer = TakServerInstaller(
            docker_zip_path=file_path,
            postgres_password=request.form['postgres_password'],
            certificate_password=request.form['certificate_password'],
            organization=request.form['organization'],
            state=request.form['state'],
            city=request.form['city'],
            organizational_unit=request.form['organizational_unit'],
            name=request.form['name']
        )

        try:
            success = installer.main()
            if success:
                if os.path.exists(file_path):
                    os.remove(file_path)
                return '', 200
            return '', 500
            
        except Exception as install_error:
            logger.error(f"Installation failed, attempting rollback: {str(install_error)}")
            try:
                installer.rollback_takserver_installation()
            except Exception as rollback_error:
                logger.error(f"Rollback failed: {str(rollback_error)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise install_error

    except Exception as e:
        logger.error(f"Installation error: {str(e)}")
        return '', 500

@takserver_bp.route('/takserver-status', methods=['GET'])
def get_takserver_status():
    try:
        status_checker.get_status()
        return '', 204
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        return '', 500

@takserver_bp.route('/stop-installation', methods=['POST'])
def stop_installation():
    try:
        # Create installer instance
        installer = TakServerInstaller(
            docker_zip_path='',  # Not needed for rollback
            postgres_password='',
            certificate_password='',
            organization='',
            state='',
            city='',
            organizational_unit='',
            name=''
        )
        # Stop installation and perform rollback
        installer.stop_installation()
        return '', 200
    except Exception as e:
        logger.error(f"Stop installation error: {str(e)}")
        return '', 500

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    status_checker.start_containers()
    return '', 204

@takserver_bp.route('/takserver-stop', methods=['POST']) 
def stop_takserver():
    status_checker.stop_containers()
    return '', 204

@takserver_bp.route('/takserver-restart', methods=['POST'])
def restart_takserver():
    status_checker.restart_containers()
    return '', 204

@takserver_bp.route('/uninstall-takserver', methods=['POST'])
def uninstall_takserver():
    try:
        uninstaller = TakServerUninstaller()
        success = uninstaller.uninstall()
        return '', 200 if success else 500
    except Exception as e:
        logger.error(f"Uninstallation error: {str(e)}")
        return '', 500