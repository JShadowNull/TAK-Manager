# backend/__init__.py
import os
from flask import Flask, send_from_directory, request
from flask_sse import sse
from backend.config.logging_config import configure_logging

# Import blueprints
from backend.routes.dashboard_routes import dashboard_bp
from backend.routes.docker_manager_routes import docker_manager_bp
from backend.routes.data_package_route import data_package_bp
from backend.routes.transfer_route import transfer_bp
from backend.routes.takserver_routes import takserver_bp
from backend.routes.ota_routes import ota_bp
from backend.routes.certmanager_routes import certmanager_bp

def create_app():
    # Set up logging
    logger = configure_logging(__name__)
    logger.info("Creating Flask application")
    
    # Determine mode
    is_dev = os.environ.get('MODE', 'development') == 'development'
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Configure app based on mode
    app.config.update(
        ENV='development' if is_dev else 'production',
        DEBUG=is_dev,
        
        # General app config
        MAX_CONTENT_LENGTH=None,
        MAX_CONTENT_PATH=None,
        UPLOAD_CHUNK_SIZE=8 * 1024 * 1024,
        
        # Redis config
        REDIS_URL=os.environ.get('REDIS_URL', 'redis://redis:6379'),
        SSE_REDIS_URL=os.environ.get('REDIS_URL', 'redis://redis:6379'),
        SSE_RETRY_TIMEOUT=5000  # Retry every 5 seconds
    )

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy'}, 200

    # Only serve static files in production mode
    if not is_dev:
        client_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "client"))
        build_dir = os.path.join(client_dir, 'build')
        
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_react(path):
            if path and os.path.exists(os.path.join(build_dir, path)):
                return send_from_directory(build_dir, path)
            return send_from_directory(build_dir, 'index.html')

    # Register blueprints
    app.register_blueprint(sse, url_prefix='/stream')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(docker_manager_bp, url_prefix='/api/docker-manager')
    app.register_blueprint(data_package_bp, url_prefix='/api/datapackage')
    app.register_blueprint(transfer_bp, url_prefix='/api/transfer')
    app.register_blueprint(takserver_bp, url_prefix='/api/takserver')
    app.register_blueprint(ota_bp, url_prefix='/api/ota')
    app.register_blueprint(certmanager_bp, url_prefix='/api/certmanager')

    logger.info(f"Flask application created in {'development' if is_dev else 'production'} mode")
    return app
