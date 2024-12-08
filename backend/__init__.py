# backend/__init__.py
import os
from flask import Flask, send_from_directory
from backend.routes.socketio import socketio

def create_app():
    # Configure the app to use the dist directory for static files
    app = Flask(__name__,
                static_folder="../dist",
                static_url_path='')

    # Initialize socketio with the app
    socketio.init_app(app, cors_allowed_origins="*")

    # Serve the React frontend
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(app.static_folder + '/' + path):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    # Import and register blueprints after initializing socketio
    from backend.routes.dashboard_routes import dashboard_bp
    from backend.routes.installer_routes import docker_bp, ota_update_bp
    from backend.routes.docker_manager_routes import docker_manager_bp
    from backend.routes.data_package_route import data_package_bp
    from backend.routes.transfer_route import transfer_bp
    from backend.routes.takserver_routes import takserver_bp
    from backend.routes.ota_routes import ota_bp

    # Register API routes with /api prefix
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(docker_bp, url_prefix='/api')
    app.register_blueprint(docker_manager_bp, url_prefix='/api')
    app.register_blueprint(ota_update_bp, url_prefix='/api')
    app.register_blueprint(data_package_bp, url_prefix='/api')
    app.register_blueprint(transfer_bp, url_prefix='/api')
    app.register_blueprint(takserver_bp, url_prefix='/api/takserver')
    app.register_blueprint(ota_bp, url_prefix='/api/ota')

    return app
