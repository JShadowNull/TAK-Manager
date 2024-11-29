import eventlet
eventlet.monkey_patch()

import threading
import webbrowser
import logging
import os
from flask import Flask
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.helpers.os_detector import OSDetector
import atexit
import webview

# Configure logging
logging.basicConfig(level=logging.DEBUG)
webview_logger = logging.getLogger('webview')
webview_logger.setLevel(logging.DEBUG)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

class API:
    def open_url(self, url):
        webbrowser.open(url)

def start_flask():
    """Start the Flask server using SocketIO with eventlet."""
    from backend import create_app
    from backend.routes.socketio import socketio, DockerManagerNamespace

    # Create the Flask app instance
    app = create_app()
    
    # Enable development settings
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.jinja_env.auto_reload = True
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    # Start the system monitor
    from backend.services.scripts.system.system_monitor import start_system_monitor
    start_system_monitor(app)

    # Start Docker monitoring
    socketio.start_background_task(DockerManagerNamespace('/docker-manager').monitor_docker_status)

    # Run the Flask server
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, use_reloader=False)

def cleanup():
    thread_manager.cleanup_threads()

atexit.register(cleanup)

if __name__ == '__main__':
    print("Starting development server...")
    
    # Start Flask in a separate thread
    flask_thread = threading.Thread(target=start_flask)
    flask_thread.daemon = True
    flask_thread.start()

    # Give Flask time to start
    import time
    time.sleep(2)

    # Create API instance
    api = API()

    # Configure GUI based on OS
    if current_os == 'linux':
        os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '8228'
        gui = 'qt'
    elif current_os == 'macos':
        gui = 'gtk'
    else:
        gui = None

    # Create window pointing to Vite
    window = webview.create_window(
        "Tak Manager (Dev)",
        "http://localhost:5173",
        width=1280,
        height=720,
        resizable=True,
        min_size=(1280, 720),
        frameless=False,
        js_api=api
    )

    # Start webview
    if gui:
        webview.start(debug=True, gui=gui)
    else:
        webview.start(debug=True)