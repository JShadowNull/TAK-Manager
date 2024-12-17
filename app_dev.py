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
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import threading
import eventlet

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set log levels for all loggers
logging.getLogger('werkzeug').setLevel(logging.INFO)
logging.getLogger('engineio').setLevel(logging.INFO)
logging.getLogger('socketio').setLevel(logging.DEBUG)  # Keep Socket.IO debug logs
logging.getLogger('watchdog').setLevel(logging.INFO)
logging.getLogger('backend').setLevel(logging.DEBUG)
logging.getLogger('flask').setLevel(logging.INFO)

# Enable debug logging for your application modules
for logger_name in ['backend', 'services', 'routes']:
    module_logger = logging.getLogger(logger_name)
    module_logger.setLevel(logging.DEBUG)
    # Ensure logger propagates to root
    module_logger.propagate = True

# Configure webview logger separately
webview_logger = logging.getLogger('webview')
webview_logger.setLevel(logging.INFO)

logger = logging.getLogger(__name__)
logger.info("Starting application in development mode with debug logging enabled")

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

# Global variables for process management
server_process = None
frontend_process = None
observer = None
restart_event = threading.Event()
window = None

class API:
    def open_url(self, url):
        webbrowser.open(url)

class BackendEventHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('.py'):
            logger.info(f"Backend file changed: {event.src_path}")
            restart_event.set()

class FrontendEventHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html')):
            logger.info(f"Frontend file changed: {event.src_path}")

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
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex(('127.0.0.1', port))
                if result == 0:
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
    """Start the Flask server in development mode."""
    logger.info("Starting Flask server in development mode...")
    try:
        # Set development environment
        os.environ['FLASK_ENV'] = 'development'
        os.environ['FLASK_DEBUG'] = '1'
        os.environ['PYTHONUNBUFFERED'] = '1'  # Ensure Python output is unbuffered
        os.environ['WERKZEUG_DEBUG_PIN'] = 'off'  # Disable Werkzeug debug PIN
        os.environ['EVENTLET_DEBUG'] = 'true'  # Enable eventlet debug
        
        # Create Flask app with debug mode
        flask_app = create_app()
        flask_app.debug = True
        flask_app.config['PROPAGATE_EXCEPTIONS'] = True  # Ensure exceptions are propagated
        
        # Configure Socket.IO for development
        socketio.server.eio.ping_timeout = 120000  # Increase ping timeout for development
        socketio.server.eio.ping_interval = 25000  # Standard ping interval
        socketio.server.eio.cors_allowed_origins = ['http://localhost:5173']  # Allow Vite dev server
        socketio.server.eio.max_http_buffer_size = 1e8  # 100MB max buffer
        
        # Enable Socket.IO logging
        socketio.server.logger.setLevel(logging.DEBUG)
        socketio.server.eio.logger.setLevel(logging.DEBUG)
        
        # Run without reloader
        socketio.run(flask_app, 
                    host='127.0.0.1', 
                    port=5000, 
                    debug=True, 
                    use_reloader=False,
                    log_output=True,
                    allow_unsafe_werkzeug=True)  # Allow unsafe Werkzeug in dev
    except Exception as e:
        logger.error(f"Error starting Flask server: {e}", exc_info=True)
        raise

def restart_server():
    """Restart the Flask server."""
    global server_process
    if server_process:
        logger.info("Restarting Flask server...")
        try:
            server_process.terminate()
            server_process.join(timeout=5)
            if server_process.is_alive():
                server_process.kill()
                server_process.join()
        except Exception as e:
            logger.error(f"Error during server shutdown: {e}")
        
        start_server()
        # Wait for server to be ready after restart
        wait_for_port(5000)

def start_server():
    """Start the Flask server process."""
    global server_process
    server_process = multiprocessing.Process(target=start_flask)
    server_process.daemon = True
    server_process.start()

def setup_watchers():
    """Setup file watchers for auto-reloading."""
    global observer
    observer = Observer()
    
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Watch backend directory
    backend_dir = os.path.join(root_dir, 'backend')
    observer.schedule(BackendEventHandler(), backend_dir, recursive=True)
    
    # Watch frontend src directory
    frontend_dir = os.path.join(root_dir, 'src')
    if os.path.exists(frontend_dir):
        observer.schedule(FrontendEventHandler(), frontend_dir, recursive=True)
    
    observer.start()
    logger.info("File watchers started")

def start_vite():
    """Start the Vite development server."""
    try:
        # Change to the project root directory
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        
        # Start Vite in development mode
        process = subprocess.Popen(
            'npm run dev',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, 'FORCE_COLOR': '1'}  # Enable colored output
        )
        
        logger.info("Started Vite development server")
        return process
    except Exception as e:
        logger.error(f"Error starting Vite server: {e}")
        raise

def main():
    try:
        # Register cleanup
        atexit.register(cleanup)

        # Start the Flask server first
        start_server()

        # Wait for Flask server to be ready
        if not wait_for_port(5000):
            logger.error("Error: Flask server did not start properly")
            return

        # Start Vite development server
        vite_process = start_vite()

        # Wait for Vite server to be ready
        if not wait_for_port(5173):
            logger.error("Error: Vite server did not start properly")
            if vite_process:
                vite_process.terminate()
            return

        # Setup file watchers
        setup_watchers()

        # Add a small delay to ensure servers are fully initialized
        time.sleep(2)
        logger.info("All servers are ready, starting PyWebview...")

        try:
            # Create and start the window
            window = create_window()
            if not window:
                raise Exception("Failed to create window")
        except Exception as e:
            logger.error(f"Failed to start PyWebview: {e}")
            raise
        finally:
            # Clean up processes
            if vite_process:
                vite_process.terminate()
                vite_process.wait()

    except Exception as e:
        logger.error(f"Error in main: {e}")
        raise

def create_window():
    """Create and configure the pywebview window."""
    try:
        # Configure GUI based on OS
        gui = None
        if current_os == 'linux':
            os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '8228'
            gui = 'qt'
        elif current_os == 'macos':
            gui = None
            os.environ['PYWEBVIEW_DARWIN_DISABLE_AUTORESIZE'] = '1'

        logger.info(f"Using GUI backend: {gui or 'default'}")
        
        # Create API instance
        api = API()
        
        # Use Vite development server URL instead of Flask URL
        window = webview.create_window(
            'Tak Manager (Dev)',
            'http://localhost:5173',  # Changed to Vite dev server URL
            js_api=api,
            min_size=(800, 600),
            width=1280,
            height=720
        )
        
        # Start webview with appropriate GUI
        if gui:
            webview.start(debug=True, gui=gui)
        else:
            webview.start(debug=True)
            
        return window
    except Exception as e:
        logger.error(f"Error creating window: {e}", exc_info=True)
        return None

def cleanup():
    """Clean up all resources."""
    logger.info("Cleaning up resources...")
    
    global server_process, observer
    
    # Stop the file watcher
    if observer:
        observer.stop()
        observer.join()
    
    # Clean up processes
    if server_process:
        try:
            server_process.terminate()
            server_process.join(timeout=5)
            if server_process.is_alive():
                server_process.kill()
        except Exception as e:
            logger.error(f"Error cleaning up server process: {e}")
    
    # Clean up threads
    thread_manager.cleanup_threads()

def reloader_thread():
    """Thread that handles server reloading."""
    while True:
        restart_event.wait()
        restart_event.clear()
        restart_server()

if __name__ == '__main__':
    multiprocessing.freeze_support()
    main() 