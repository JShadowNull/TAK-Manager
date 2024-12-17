# app.py

import webbrowser
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
import webview
import signal
import sys

# Configure logging for both Flask and webview
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
webview_logger = logging.getLogger('webview')
webview_logger.setLevel(logging.ERROR)

# Suppress unnecessary warnings
logging.getLogger('werkzeug').setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('socketio').setLevel(logging.ERROR)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

# Define a simple API class
class API:
    def open_url(self, url):
        webbrowser.open(url)

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect(('127.0.0.1', port))
            return True
        except (socket.error, socket.timeout):
            return False

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
        # Ignore SIGINT in the server process
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        
        # Create Flask app
        flask_app = create_app()
        
        # Configure Socket.IO CORS - only allow our specific origin
        socketio.server.eio.cors_allowed_origins = ['http://127.0.0.1:5000']
        
        # Run with eventlet
        socketio.run(flask_app, 
                    host='127.0.0.1', 
                    port=5000, 
                    debug=False, 
                    use_reloader=False,
                    log_output=False)  # Disable default Socket.IO logging
    except Exception as e:
        logger.error(f"Error starting Flask server: {e}", exc_info=True)
        raise

def cleanup():
    logger.info("Cleaning up resources...")
    thread_manager.cleanup_threads()

def create_window():
    """Create and configure the pywebview window."""
    try:
        # Configure GUI based on OS
        gui = None
        if current_os == 'linux':
            os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '0'  # Disable remote debugging
            gui = 'qt'
        elif current_os == 'macos':
            gui = None
            os.environ['PYWEBVIEW_DARWIN_DISABLE_AUTORESIZE'] = '1'

        logger.info(f"Using GUI backend: {gui or 'default'}")
        
        # Create API instance
        api = API()
        
        # Basic window configuration
        window = webview.create_window(
            'Tak Manager',
            'http://127.0.0.1:5000',
            js_api=api,
            min_size=(800, 600),
            width=1280,
            height=720
        )
        
        # Start webview without debug mode
        if gui:
            webview.start(debug=False, gui=gui)
        else:
            webview.start(debug=False)
            
        return window
    except Exception as e:
        logger.error(f"Error creating window: {e}", exc_info=True)
        # In production, we should handle this more gracefully
        if window:
            try:
                window.destroy()
            except:
                pass
        return None

def main():
    try:
        # Register cleanup
        atexit.register(cleanup)

        # Start the Flask server in a separate process
        logger.info("Starting Flask server process...")
        server_process = multiprocessing.Process(target=start_flask)
        server_process.daemon = True
        server_process.start()

        # Wait for the server to be fully ready
        if not wait_for_port(5000):
            logger.error("Error: Flask server did not start properly")
            server_process.terminate()
            return

        # Add a small delay to ensure server is fully initialized
        time.sleep(2)
        logger.info("Flask server is ready, starting PyWebview...")

        try:
            # Create and start the window
            window = create_window()
            if not window:
                raise Exception("Failed to create window")
        except Exception as e:
            logger.error(f"Failed to start PyWebview: {e}", exc_info=True)
            raise
        finally:
            # Clean up the server process
            logger.info("Cleaning up server process...")
            try:
                server_process.terminate()
                server_process.join(timeout=5)
                if server_process.is_alive():
                    server_process.kill()
            except Exception as e:
                logger.error(f"Error during server cleanup: {e}", exc_info=True)

    except Exception as e:
        logger.error(f"Critical error in main: {e}", exc_info=True)
        sys.exit(1)  # Exit with error code

if __name__ == '__main__':
    # This is needed for Windows support
    multiprocessing.freeze_support()
    main()
