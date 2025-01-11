# backend/routes/docker_manager_routes.py

from flask import Blueprint, jsonify, request
import docker
import json
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

docker_manager_bp = Blueprint('docker_manager', __name__)
docker_manager = DockerManager()

@docker_manager_bp.route('/containers/updates/start', methods=['POST'])
def start_container_updates():
    """Trigger initial container list update via SSE"""
    try:
        docker_manager._send_containers_update()
        return jsonify({'status': 'success', 'message': 'Container updates started'}), 200
    except Exception as e:
        logger.error(f"Failed to start container updates: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@docker_manager_bp.route('/containers/<container_name>/start', methods=['POST'])
def start_container(container_name):
    """Start a container by name"""
    try:
        result = docker_manager.start_container(container_name)
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Failed to start container {container_name}: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@docker_manager_bp.route('/containers/<container_name>/stop', methods=['POST'])
def stop_container(container_name):
    """Stop a container by name"""
    try:
        result = docker_manager.stop_container(container_name)
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Failed to stop container {container_name}: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@docker_manager_bp.route('/container/<container_id>/restart', methods=['POST'])
def restart_container(container_id):
    try:
        container = client.containers.get(container_id)
        container.restart()
        return 200
    except Exception:
        return 500


