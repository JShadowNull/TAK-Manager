import os
import sys
import uvicorn


# Add the server directory to Python path
server_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, server_dir)

# Import our modules after path setup
from backend import create_app
from backend.config.logging_config import configure_logging

# Configure logging
logger = configure_logging(__name__)

def start_server():
    """Start the FastAPI server."""
    try:
        # Get configuration
        port = os.getenv('BACKEND_PORT')
        if port is None:
            logger.error("BACKEND_PORT environment variable is not set.")
            raise ValueError("BACKEND_PORT must be set.")
        port = int(port)
        
        is_dev = os.getenv('MODE', 'development') == 'development'
        
        # Create and configure FastAPI app
        app = create_app()
        
        if is_dev:
            logger.info("Starting development server with auto-reload")
            uvicorn.run("app:create_app", host="0.0.0.0", port=port, reload=True, factory=True)
        else:
            logger.info("Starting production server")
            uvicorn.run(app, host="0.0.0.0", port=port)
        
    except Exception as e:
        logger.error(f"Server failed to start: {e}", exc_info=True)
        raise

if __name__ == '__main__':
    try:
        start_server()
    except KeyboardInterrupt:
        logger.info("Server shutting down...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1) 