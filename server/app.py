# app.py

import logging
import os
import socket
import time
import multiprocessing
from backend import create_app
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.helpers.os_detector import OSDetector
import atexit
import signal
import sys

# Configure logging
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Suppress unnecessary warnings
logging.getLogger('werkzeug').setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('socketio').setLevel(logging.ERROR)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

def wait_for_port(port, timeout=30):
    """Wait for the port to be available and server to be ready."""
    logger.info(f"Waiting for port {port} to be available...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Check if port is open
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex(('127.0.0.1', port))
                if result == 0:
                    # Try to make a test request to ensure server is responding
                    try:
                        import requests
                        response = requests.get(f'http://127.0.0.1:{port}/')
                        if response.status_code == 200:
                            logger.info(f"Server is fully ready on port {port}!")
                            return True
                    except Exception:
                        pass
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    return False

def start_flask():
    """Start the Flask server."""
    logger.info("Starting Flask server...")
    try:
        # Get port from environment or use default
        port = int(os.environ.get('PORT', 8989))
        
        # Ignore SIGINT in the server process
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        
        # Create Flask app
        flask_app = create_app()
        
        # Run with eventlet
        socketio.run(flask_app, 
                    host='0.0.0.0',  # Changed to 0.0.0.0 to allow external access
                    port=port, 
                    debug=False, 
                    use_reloader=False,
                    log_output=False)
    except Exception as e:
        logger.error(f"Error starting Flask server: {e}", exc_info=True)
        raise

def cleanup():
    logger.info("Cleaning up resources...")
    thread_manager.cleanup_threads()

def main():
    try:
        # Register cleanup
        atexit.register(cleanup)

        # Start the Flask server in the main process
        start_flask()

    except Exception as e:
        logger.error(f"Critical error in main: {e}", exc_info=True)
        sys.exit(1)  # Exit with error code

if __name__ == '__main__':
    # This is needed for Windows support
    multiprocessing.freeze_support()
    main()
