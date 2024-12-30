# backend/__init__.py
import os
from flask import Flask, send_from_directory, send_file, Response, request
from backend.routes.socketio import socketio
import logging
from flask_cors import CORS

def create_app():
    # Get the absolute path to the dist and src directories
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
    src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))

    # Get environment variables without defaults
    flask_env = os.environ['FLASK_ENV']
    frontend_port = os.environ['FRONTEND_PORT']
    
    # CORS settings from environment
    allowed_origins = os.environ['CORS_ALLOWED_ORIGINS'].split(',')
    allow_credentials = os.environ['CORS_ALLOW_CREDENTIALS'].lower() == 'true'
    allow_methods = os.environ['CORS_ALLOW_METHODS'].split(',')
    allow_headers = os.environ['CORS_ALLOW_HEADERS']
    expose_headers = os.environ['CORS_EXPOSE_HEADERS']

    if flask_env == 'development':
        static_folder = src_dir
    else:
        static_folder = dist_dir
    
    # Configure the app with the appropriate static folder
    app = Flask(__name__,
                static_folder=static_folder,
                static_url_path='')

    # Enable CORS with environment-based configuration
    CORS(app, 
         resources={
             r"/*": {
                 "origins": allowed_origins,
                 "methods": allow_methods,
                 "allow_headers": allow_headers,
                 "expose_headers": expose_headers,
                 "supports_credentials": allow_credentials
             }
         })

    # Single initialization with all settings
    socketio.init_app(app,
        async_mode='eventlet',
        ping_timeout=int(os.environ['SOCKET_PING_TIMEOUT']),
        ping_interval=int(os.environ['SOCKET_PING_INTERVAL']),
        cors_allowed_origins=allowed_origins,
        path=os.environ['SOCKET_PATH'],
        manage_session=False,
        always_connect=True,
        max_http_buffer_size=int(os.environ['SOCKET_MAX_HTTP_BUFFER_SIZE']),
        async_handlers=True,
        logger=flask_env == 'development',
        engineio_logger=flask_env == 'development',
        allow_upgrades=True,
        transports=['websocket']
    )

    # Set logging level based on environment
    log_level = os.environ['DEV_LOG_LEVEL'] if flask_env == 'development' else os.environ['PROD_LOG_LEVEL']
    app.logger.setLevel(getattr(logging, log_level))

    # Add CORS headers to all responses
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = allow_headers
            response.headers['Access-Control-Allow-Methods'] = ','.join(allow_methods)
            response.headers['Access-Control-Max-Age'] = '3600'
            response.headers['Access-Control-Expose-Headers'] = expose_headers
            if allow_credentials:
                response.headers['Access-Control-Allow-Credentials'] = str(allow_credentials).lower()
            response.headers['Vary'] = 'Origin'
            
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    # Handle OPTIONS requests explicitly
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def options_handler(path):
        response = app.make_default_options_response()
        origin = request.headers.get('Origin')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = allow_headers
            response.headers['Access-Control-Allow-Methods'] = ','.join(allow_methods)
            response.headers['Access-Control-Max-Age'] = '3600'
            response.headers['Access-Control-Expose-Headers'] = expose_headers
            if allow_credentials:
                response.headers['Access-Control-Allow-Credentials'] = str(allow_credentials).lower()
            response.headers['Vary'] = 'Origin'
        return response

    # Serve static files directly
    @app.route('/assets/<path:filename>')
    def serve_static(filename):
        return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

    # Serve the frontend
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        app.logger.debug(f"Serving path: {path}")
        try:
            if os.environ.get('FLASK_ENV') == 'development':
                # Serve from src in development
                if not path:
                    app.logger.debug("Serving index.html from src for root path")
                    return send_file(os.path.join(src_dir, 'index.html'))
                
                file_path = os.path.join(src_dir, path)
                if os.path.isfile(file_path):
                    app.logger.debug(f"Serving file from src: {file_path}")
                    return send_file(file_path)
                
                app.logger.debug(f"Path {path} not found in src, serving index.html")
                return send_file(os.path.join(src_dir, 'index.html'))
            else:
                # Serve from dist in production (existing logic)
                if not path:
                    app.logger.debug("Serving index.html from dist for root path") 
                    return send_file(os.path.join(dist_dir, 'index.html'))
                
                file_path = os.path.join(dist_dir, path)
                if os.path.isfile(file_path):
                    app.logger.debug(f"Serving file from dist: {file_path}")
                    return send_file(file_path)
                
                app.logger.debug(f"Path {path} not found in dist, serving index.html")
                return send_file(os.path.join(dist_dir, 'index.html'))

        except Exception as e:
            app.logger.error(f"Error serving file: {str(e)}")
            return str(e), 500
            
    # Add error handler for debugging
    @app.errorhandler(Exception)
    def handle_error(error):
        app.logger.error(f'Error: {str(error)}')
        return str(error), 500

    # Add health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy'}, 200

    # Import and register blueprints after initializing socketio
    from backend.routes.dashboard_routes import dashboard_bp
    from backend.routes.installer_routes import docker_bp, ota_update_bp
    from backend.routes.docker_manager_routes import docker_manager_bp
    from backend.routes.data_package_route import data_package_bp
    from backend.routes.transfer_route import transfer_bp
    from backend.routes.takserver_routes import takserver_bp
    from backend.routes.ota_routes import ota_bp
    from backend.routes.certmanager_routes import certmanager_bp
    
    # Register API routes with /api prefix
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(docker_bp, url_prefix='/api')
    app.register_blueprint(docker_manager_bp, url_prefix='/docker-manager')
    app.register_blueprint(ota_update_bp, url_prefix='/api')
    app.register_blueprint(data_package_bp, url_prefix='/datapackage')
    app.register_blueprint(transfer_bp, url_prefix='/transfer')
    app.register_blueprint(takserver_bp, url_prefix='/api/takserver')
    app.register_blueprint(ota_bp, url_prefix='/api/ota')
    app.register_blueprint(certmanager_bp, url_prefix='/certmanager')

    return app
