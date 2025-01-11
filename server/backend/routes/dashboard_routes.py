# backend/routes/dashboard_routes.py

from flask import Blueprint, jsonify
from ..services.scripts.system.system_monitor import SystemMonitor
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

dashboard_bp = Blueprint('dashboard', __name__)
system_monitor = SystemMonitor()

@dashboard_bp.route('/monitoring/start', methods=['POST'])
def start_all_monitoring():
    """Send initial system metrics via SSE"""
    try:
        result = system_monitor.send_system_metrics()
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error sending system metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
