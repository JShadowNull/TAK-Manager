# app.py
import eventlet
eventlet.monkey_patch()

import multiprocessing
import webbrowser
import logging
import os
from flask import Flask
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.helpers.os_detector import OSDetector  # Import OSDetector
import atexit
import webview

# Configure logging for both Flask and webview
logging.basicConfig(level=logging.DEBUG)
webview_logger = logging.getLogger('webview')
webview_logger.setLevel(logging.DEBUG)

# Initialize OS detector
os_detector = OSDetector()
current_os = os_detector.detect_os()

# Define a class to hold your API functions
class API:
    def open_url(self, url):
        webbrowser.open(url)

def start_flask():
    """Start the Flask server using SocketIO with eventlet."""
    from backend import create_app
    from backend.routes.socketio import socketio, DockerManagerNamespace

    # Create the Flask app instance
    app = create_app()

    # Start the system monitor with the app instance
    from backend.services.scripts.system.system_monitor import start_system_monitor
    start_system_monitor(app)

    # Start the background task to monitor Docker status and containers
    socketio.start_background_task(DockerManagerNamespace('/docker-manager').monitor_docker_status)

    # Run the Flask server
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, use_reloader=False)

def cleanup():
    thread_manager.cleanup_threads()

atexit.register(cleanup)

if __name__ == '__main__':
    # Start the Flask server in a separate process
    flask_process = multiprocessing.Process(target=start_flask)
    flask_process.start()

    # Wait for the Flask server to start
    import time
    time.sleep(5)  # Adjust the sleep time if necessary

    # Create an instance of the API class
    api = API()

    # Configure debug options based on OS
    if current_os == 'linux':
        # For Linux/Qt
        os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = '8228'
        gui = 'qt'
    elif current_os == 'macos':
        # For macOS
        gui = 'gtk'
    else:
        # For Windows or others
        gui = None

    # Create the PyWebview window
    window = webview.create_window(
        "Tak Manager",
        "http://127.0.0.1:5000/",
        width=1280,
        height=720,
        resizable=True,
        min_size=(1280, 720),
        frameless=False,
        js_api=api
    )

    # Start webview with debug enabled and appropriate GUI
    if gui:
        webview.start(debug=True, gui=gui)
    else:
        webview.start(debug=True)

    # Clean up the Flask server when the PyWebview window is closed
    flask_process.terminate()
    flask_process.join()
