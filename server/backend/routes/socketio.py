# backend/services/socketio_handler.py

import os
from flask_socketio import SocketIO, Namespace

# Initialize SocketIO with eventlet
socketio = SocketIO(
    async_mode=os.environ['SOCKET_ASYNC_MODE'],
    engineio_logger=os.environ['FLASK_ENV'] == 'development',
    logger=os.environ['FLASK_ENV'] == 'development',
    ping_timeout=int(os.environ['SOCKET_PING_TIMEOUT']),
    ping_interval=int(os.environ['SOCKET_PING_INTERVAL']),
    cors_allowed_origins=os.environ['CORS_ALLOWED_ORIGINS'].split(','),
    path=os.environ['SOCKET_PATH'],
    manage_session=False,
    always_connect=True,
    max_http_buffer_size=int(os.environ['SOCKET_MAX_HTTP_BUFFER_SIZE']),
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