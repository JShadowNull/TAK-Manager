# backend/services/socketio_handler.py

from flask_socketio import SocketIO, Namespace

# Initialize SocketIO with eventlet
socketio = SocketIO(
    async_mode='eventlet',
    engineio_logger=False,
    logger=False,
    ping_timeout=60,
    cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    path='/socket.io',
    manage_session=False,
    always_connect=True,
    max_http_buffer_size=1e8,
    async_handlers=True,
    allow_upgrades=True,
    transports=['websocket']
)

def safe_emit(event, data, namespace=None, broadcast=False):
    """Thread-safe emit function using eventlet"""
    try:
        if broadcast:
            socketio.emit(event, data, namespace=namespace)
        else:
            socketio.emit(event, data, namespace=namespace, include_self=True)
    except Exception as e:
        print(f"Error in safe_emit: {e}")