import webbrowser
import logging
import os
import socket
import time
import multiprocessing
import sys
import eventlet
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import threading
import webview
import signal
import atexit

# Add the server directory to Python path
server_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, server_dir)

from backend import create_app
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.helpers.os_detector import OSDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(server_dir, 'app_dev.log')),
        logging.StreamHandler(sys.stdout)
    ]
)

# Set log levels
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('engineio').setLevel(logging.WARNING)
logging.getLogger('socketio').setLevel(logging.WARNING)
logging.getLogger('watchdog').setLevel(logging.WARNING)
logging.getLogger('webview').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

# Global variables
server_process = None
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

def wait_for_port(port, timeout=30):
    """Wait for the port to be available."""
    logger.info(f"Waiting for port {port}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                if s.connect_ex(('127.0.0.1', port)) == 0:
                    logger.info(f"Port {port} is ready")
                    return True
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    logger.error(f"Timeout waiting for port {port}")
    return False

def start_flask():
    """Start the Flask server in development mode."""
    try:
        # Set development environment
        os.environ.update({
            'FLASK_ENV': 'development',
            'FLASK_DEBUG': '1',
            'PYTHONUNBUFFERED': '1',
            'WERKZEUG_DEBUG_PIN': 'off',
            'EVENTLET_DEBUG': 'true'
        })
        
        # Create and configure Flask app
        flask_app = create_app()
        flask_app.debug = True
        flask_app.config['PROPAGATE_EXCEPTIONS'] = True
        
        # Configure Socket.IO
        socketio.server.eio.ping_timeout = 120000
        socketio.server.eio.ping_interval = 25000
        socketio.server.eio.cors_allowed_origins = ['http://localhost:5173']
        
        # Run server
        socketio.run(flask_app, 
                    host='127.0.0.1', 
                    port=5000, 
                    debug=True, 
                    use_reloader=False,
                    log_output=True,
                    allow_unsafe_werkzeug=True)
    except Exception as e:
        logger.error(f"Error starting Flask server: {e}", exc_info=True)
        raise

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
    
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Watch backend directory
    backend_dir = os.path.join(server_dir, 'backend')
    observer.schedule(BackendEventHandler(), backend_dir, recursive=True)
    
    # Watch frontend src directory
    frontend_dir = os.path.join(workspace_root, 'client', 'src')
    if os.path.exists(frontend_dir):
        observer.schedule(FrontendEventHandler(), frontend_dir, recursive=True)
    
    observer.start()
    logger.info("File watchers started")

def start_vite():
    """Start the Vite development server."""
    try:
        workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        client_dir = os.path.join(workspace_root, 'client')
        original_dir = os.getcwd()
        
        try:
            os.chdir(client_dir)
            process = subprocess.Popen(
                'npm run dev',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env={**os.environ, 'FORCE_COLOR': '1'}
            )
            return process
        finally:
            os.chdir(original_dir)
    except Exception as e:
        logger.error(f"Error starting Vite server: {e}")
        raise

def create_window():
    """Create and configure the pywebview window."""
    try:
        # Configure GUI based on OS
        gui = 'qt' if current_os == 'linux' else None
        if current_os == 'linux':
            os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '8228'
        elif current_os == 'macos':
            os.environ['PYWEBVIEW_DARWIN_DISABLE_AUTORESIZE'] = '1'
        
        # Create window
        window = webview.create_window(
            'Tak Manager (Dev)',
            'http://localhost:5173',
            js_api=API(),
            min_size=(800, 600),
            width=1280,
            height=720
        )
        
        webview.start(debug=True, gui=gui)
        return window
    except Exception as e:
        logger.error(f"Error creating window: {e}")
        return None

def cleanup():
    """Clean up all resources."""
    logger.info("Cleaning up resources...")
    
    if observer:
        observer.stop()
        observer.join()
    
    if server_process:
        try:
            server_process.terminate()
            server_process.join(timeout=5)
            if server_process.is_alive():
                server_process.kill()
        except Exception as e:
            logger.error(f"Error cleaning up server process: {e}")
    
    thread_manager.cleanup_threads()

def main():
    try:
        atexit.register(cleanup)
        start_server()

        if not wait_for_port(5000):
            logger.error("Flask server failed to start")
            cleanup()
            return

        time.sleep(2)
        vite_process = start_vite()

        if not wait_for_port(5173):
            logger.error("Vite server failed to start")
            if vite_process:
                vite_process.terminate()
            cleanup()
            return

        setup_watchers()
        
        try:
            window = create_window()
            if not window:
                raise Exception("Failed to create window")
        except Exception as e:
            logger.error(f"Failed to start PyWebview: {e}")
            raise
        finally:
            if vite_process:
                vite_process.terminate()
                vite_process.wait()

    except Exception as e:
        logger.error(f"Error in main: {e}")
        raise

if __name__ == '__main__':
    multiprocessing.freeze_support()
    main() 