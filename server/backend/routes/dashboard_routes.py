# backend/routes/dashboard_routes.py

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from ..services.scripts.system.system_monitor import SystemMonitor
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

dashboard = APIRouter()

# Global state for SSE events
_latest_metrics: dict = {}

def emit_metrics_event(data: dict):
    """Update latest metrics state"""
    global _latest_metrics
    _latest_metrics = data

system_monitor = SystemMonitor(emit_event=emit_metrics_event)

@dashboard.get('/monitoring/metrics-stream')
async def metrics_stream():
    """SSE endpoint for system metrics."""
    return EventSourceResponse(system_monitor.metrics_generator())

@dashboard.post('/monitoring/start')
async def start_all_monitoring():
    """Get current system metrics."""
    try:
        metrics = system_monitor.get_system_metrics()
        if not metrics:
            raise HTTPException(status_code=500, detail="Failed to get system metrics")
        return {
            "status": True,
            "data": metrics
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get system metrics: {str(e)}"
        )
