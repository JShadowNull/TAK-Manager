# backend/__init__.py

from flask import Flask, render_template
from backend.routes.socketio import socketio

def create_app():
    # Configure the app to use 'frontend/static' for static files
    app = Flask(__name__,
                template_folder="../frontend/templates",
                static_folder="../frontend/static")

    # Initialize socketio with the app
    socketio.init_app(app, cors_allowed_origins="*")

    # Serve the index page
    @app.route('/')
    def index():
        return render_template('index.html')

    # Import and register blueprints after initializing socketio
    from backend.routes.dashboard_routes import dashboard_bp
    from backend.routes.installer_routes import docker_bp, takserver_bp, ota_update_bp
    from backend.routes.docker_manager_routes import docker_manager_bp
    from backend.routes.data_package_route import data_package_bp
    from backend.routes.transfer_route import transfer_bp

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(docker_bp)
    app.register_blueprint(docker_manager_bp)
    app.register_blueprint(takserver_bp)
    app.register_blueprint(ota_update_bp)
    app.register_blueprint(data_package_bp)
    app.register_blueprint(transfer_bp)
    return app
