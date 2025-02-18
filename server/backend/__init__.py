# backend/__init__.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config.logging_config import configure_logging

# Import routers (equivalent to blueprints)
from backend.routes.dashboard_routes import dashboard
from backend.routes.docker_manager_routes import dockermanager
from backend.routes.data_package_route import datapackage
from backend.routes.data_package_manager_routes import datapackage_manager
from backend.routes.takserver_routes import takserver
from backend.routes.ota_routes import ota
from backend.routes.certmanager_routes import certmanager
from backend.routes.advanced_features_routes import advanced_features

def create_app():
    # Set up logging
    logger = configure_logging(__name__)
    logger.info("Creating FastAPI application")
    
    # Determine mode
    is_dev = os.environ.get('MODE', 'development') == 'development'
    
    # Initialize FastAPI app
    app = FastAPI(
        title="TAK Manager API",
        debug=is_dev
    )

    # Health check endpoint
    @app.get('/health')
    async def health_check():
        return {'status': 'healthy'}

    # Include routers (equivalent to registering blueprints) FIRST
    app.include_router(dashboard, prefix='/api/dashboard')
    app.include_router(dockermanager, prefix='/api/docker-manager')
    app.include_router(datapackage, prefix='/api/datapackage')
    app.include_router(datapackage_manager, prefix='/api/datapackage')
    app.include_router(takserver, prefix='/api/takserver')
    app.include_router(ota, prefix='/api/ota')
    app.include_router(certmanager, prefix='/api/certmanager')
    app.include_router(advanced_features, prefix='/api/advanced')

    # Only serve static files in production mode AFTER API routes
    if not is_dev:
        client_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "client"))
        build_dir = os.path.join(client_dir, 'build')
        app.mount("/static", StaticFiles(directory=build_dir), name="static")
        
        @app.get('/')
        async def serve_root():
            return FileResponse(os.path.join(build_dir, 'index.html'))
        
        @app.get('/{full_path:path}')
        async def serve_react(full_path: str):
            # Don't intercept API routes
            if full_path.startswith('api/'):
                raise HTTPException(status_code=404, detail="API route not found")
            
            file_path = os.path.join(build_dir, full_path)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(os.path.join(build_dir, 'index.html'))

    logger.info(f"FastAPI application created in {'development' if is_dev else 'production'} mode")
    return app
