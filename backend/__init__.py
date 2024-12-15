# backend/__init__.py
import os
from flask import Flask, send_from_directory, send_file, Response
from backend.routes.socketio import socketio
import logging
from flask_cors import CORS

def create_app():
    # Get the absolute path to the dist directory
    static_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
    
    # Configure the app to use the dist directory for static files
    app = Flask(__name__,
                static_folder=static_folder,
                static_url_path='')

    # Enable CORS with maximum permissiveness
    CORS(app, resources={r"/*": {"origins": "*", "allow_headers": "*", "expose_headers": "*"}})

    # Initialize socketio with the app
    socketio.init_app(app, 
                     async_mode='eventlet',
                     ping_timeout=60,
                     cors_allowed_origins="*",
                     manage_session=False)

    # Enable debug logging
    app.logger.setLevel(logging.DEBUG)

    # Add CORS headers to all responses
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        # Add headers specifically for pywebview
        response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.add('Pragma', 'no-cache')
        response.headers.add('Expires', '0')
        return response

    # Handle OPTIONS requests
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def options_handler(path):
        return Response('', status=200)

    # Serve static files directly
    @app.route('/assets/<path:filename>')
    def serve_static(filename):
        return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

    # Serve the React frontend
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        app.logger.debug(f"Serving path: {path}")
        try:
            # Always serve index.html for the root path
            if not path:
                app.logger.debug("Serving index.html for root path")
                return send_file(os.path.join(app.static_folder, 'index.html'))
            
            # Check if the requested file exists in the static folder
            file_path = os.path.join(app.static_folder, path)
            if os.path.isfile(file_path):
                app.logger.debug(f"Serving file: {file_path}")
                return send_file(file_path)
            
            # For all other paths, serve index.html (for client-side routing)
            app.logger.debug(f"Path {path} not found, serving index.html")
            return send_file(os.path.join(app.static_folder, 'index.html'))
            
        except Exception as e:
            app.logger.error(f"Error serving file: {str(e)}")
            return str(e), 500

    # Add error handler for debugging
    @app.errorhandler(Exception)
    def handle_error(error):
        app.logger.error(f'Error: {str(error)}')
        return str(error), 500

    # Import and register blueprints after initializing socketio
    from backend.routes.dashboard_routes import dashboard_bp
    from backend.routes.installer_routes import docker_bp, ota_update_bp
    from backend.routes.docker_manager_routes import docker_manager_bp
    from backend.routes.data_package_route import data_package_bp
    from backend.routes.transfer_route import transfer_bp
    from backend.routes.takserver_routes import takserver_bp
    from backend.routes.ota_routes import ota_bp
    from backend.routes.certmanager_routes import certmanager_routes
    
    # Register API routes with /api prefix
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(docker_bp, url_prefix='/api')
    app.register_blueprint(docker_manager_bp, url_prefix='/api')
    app.register_blueprint(ota_update_bp, url_prefix='/api')
    app.register_blueprint(data_package_bp, url_prefix='/api/datapackage')
    app.register_blueprint(transfer_bp, url_prefix='/transfer')
    app.register_blueprint(takserver_bp, url_prefix='/api/takserver')
    app.register_blueprint(ota_bp, url_prefix='/api/ota')
    app.register_blueprint(certmanager_routes, url_prefix='/api/certmanager')

    return app
