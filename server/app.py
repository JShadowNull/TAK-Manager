import os
import sys
from flask import Flask
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Add the server directory to Python path
server_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, server_dir)

# Import our modules after path setup
from backend import create_app
from backend.config.logging_config import configure_logging

# Configure logging
logger = configure_logging(__name__)

def start_server():
    """Start the Flask server."""
    try:
        # Get configuration
        port = int(os.environ.get('BACKEND_PORT', 8989))
        is_dev = os.environ.get('MODE', 'development') == 'development'
        
        # Create and configure Flask app
        app = create_app()
        
        if is_dev:
            logger.info("Starting development server with auto-reload")
            app.debug = True
            app.run(host='0.0.0.0', port=port, use_reloader=True)
        else:
            logger.info("Starting production server")
            from gevent.pywsgi import WSGIServer
            http_server = WSGIServer(('0.0.0.0', port), app, log=None)
            http_server.serve_forever()
        
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