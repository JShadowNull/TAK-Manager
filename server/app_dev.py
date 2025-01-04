import eventlet
eventlet.monkey_patch()

import logging
import os
import sys

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app_dev.log')),
        logging.StreamHandler(sys.stdout)
    ]
)

# Set log levels for specific loggers
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('engineio').setLevel(logging.WARNING)
logging.getLogger('socketio').setLevel(logging.WARNING)
logging.getLogger('watchdog').setLevel(logging.INFO)

# Now import other modules
import socket
import time
import multiprocessing
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent
import subprocess
import threading
import signal
import atexit

# Add the server directory to Python path
server_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, server_dir)

from backend import create_app
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.helpers.os_detector import OSDetector

logger = logging.getLogger(__name__)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

# Global variables
server_process = None
observer = None
restart_event = threading.Event()

class BackendEventHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_restart_time = 0
        self.restart_cooldown = 1  # Cooldown in seconds

    def should_restart(self, event):
        # Only restart for Python files
        if not event.src_path.endswith('.py'):
            return False
            
        # Skip __pycache__ and temporary files
        if '__pycache__' in event.src_path or event.src_path.endswith('.pyc'):
            return False
            
        # Check cooldown
        current_time = time.time()
        if current_time - self.last_restart_time < self.restart_cooldown:
            return False
            
        self.last_restart_time = current_time
        return True

    def on_modified(self, event):
        if isinstance(event, FileModifiedEvent) and self.should_restart(event):
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
    try:
        port = int(os.environ.get('PORT', 8989))
        flask_app = create_app()
        flask_app.debug = True
        
        socketio.run(flask_app, 
                    host='0.0.0.0',
                    port=port, 
                    debug=True, 
                    use_reloader=False,
                    log_output=True)
    except Exception as e:
        logger.error(f"Error starting Flask server: {e}", exc_info=True)
        raise

def start_server():
    """Start the Flask server process."""
    global server_process
    
    # Kill existing process if it exists
    if server_process and server_process.is_alive():
        logger.info("Terminating existing server process")
        server_process.terminate()
        server_process.join(timeout=5)
        if server_process.is_alive():
            server_process.kill()
            
    server_process = multiprocessing.Process(target=start_flask)
    server_process.daemon = True
    server_process.start()
    logger.info(f"Started new server process with PID: {server_process.pid}")

def setup_watchers():
    """Setup file watchers for auto-reloading."""
    global observer
    observer = Observer()
    
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Watch backend directory
    backend_dir = os.path.join(server_dir, 'backend')
    observer.schedule(BackendEventHandler(), backend_dir, recursive=True)
    logger.info(f"Watching backend directory: {backend_dir}")
    
    # Watch frontend src directory
    frontend_dir = os.path.join(workspace_root, 'client', 'src')
    if os.path.exists(frontend_dir):
        observer.schedule(FrontendEventHandler(), frontend_dir, recursive=True)
        logger.info(f"Watching frontend directory: {frontend_dir}")
    
    observer.start()
    logger.info("File watchers started")

def cleanup():
    """Clean up all resources."""
    logger.info("Cleaning up resources...")
    
    if observer:
        observer.stop()
        observer.join()
    
    if server_process:
        try:
            # Properly close socket connections before terminating
            socketio.stop()
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

        if not wait_for_port(int(os.environ.get('PORT', 8989))):
            logger.error("Flask server failed to start")
            cleanup()
            return

        setup_watchers()
        
        # Keep the main process running
        try:
            while True:
                if restart_event.is_set():
                    logger.info("Restarting server due to file changes...")
                    start_server()  # This will handle cleanup of old process
                    restart_event.clear()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            cleanup()

    except Exception as e:
        logger.error(f"Error in main: {e}")
        raise

if __name__ == '__main__':
    multiprocessing.freeze_support()
    main() 