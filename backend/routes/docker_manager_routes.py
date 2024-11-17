# backend/routes/docker_manager_routes.py

from flask import Blueprint, jsonify, request, render_template
from backend.services.scripts.docker.docker_manager import DockerManager

docker_manager_bp = Blueprint('service', __name__)
docker_manager = DockerManager()

# Route to render the Docker management page
@docker_manager_bp.route('/docker-manager')
def service_page():
    return render_template('services.html')

# Remove the API routes as we'll be using SocketIO for real-time communication
