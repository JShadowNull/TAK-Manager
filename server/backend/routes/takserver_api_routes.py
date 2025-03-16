from fastapi import APIRouter, HTTPException
from backend.services.scripts.takserver.connected_clients import ConnectedClients
from backend.config.logging_config import configure_logging
from sse_starlette.sse import EventSourceResponse
import asyncio
import json

logger = configure_logging(__name__)

takserver_api = APIRouter()

# Create a queue for connected clients events
connected_clients_queue = asyncio.Queue()

# Track the monitoring task
connected_clients_monitor = None
connected_clients_instance = None
# Track active connections
active_connections = 0

@takserver_api.get('/connected-clients')
async def get_connected_clients():
    """Get the list of connected clients."""
    client = ConnectedClients()
    result = await client.execute_curl_command()
    
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to retrieve connected clients.")
    
    return json.loads(result)

@takserver_api.get('/connected-clients-stream')
async def connected_clients_stream():
    """Server-Sent Events (SSE) stream for connected clients.
    
    Provides real-time updates when clients connect or disconnect from the TAK Server.
    Updates are only sent when there are changes to avoid unnecessary traffic.
    """
    global connected_clients_monitor, connected_clients_instance, active_connections
    
    # Increment active connections counter
    active_connections += 1
    logger.debug(f"New client connected to SSE stream. Active connections: {active_connections}")
    
    # Start the monitoring task if it's not already running
    if connected_clients_monitor is None or connected_clients_monitor.done():
        logger.info("Starting new connected clients monitoring task")
        connected_clients_instance = ConnectedClients()
        connected_clients_monitor = asyncio.create_task(
            connected_clients_instance.start_monitoring(connected_clients_queue)
        )
    
    async def event_generator():
        try:
            while True:
                event = await connected_clients_queue.get()
                if event["event"] == "ping":
                    # Send an empty ping event to keep the connection alive
                    yield {"event": "ping", "data": ""}
                else:
                    # Send the actual event data
                    yield {
                        "event": event["event"],
                        "data": event["data"]
                    }
        except asyncio.CancelledError:
            logger.info("Client disconnected from connected clients stream")
            raise
        finally:
            # Decrement active connections counter when client disconnects
            global active_connections
            active_connections -= 1
            logger.debug(f"Client disconnected from SSE stream. Active connections: {active_connections}")
            
            # If no more active connections, stop the monitoring task
            if active_connections <= 0:
                await stop_monitoring()
    
    return EventSourceResponse(event_generator())

@takserver_api.post('/connected-clients-stream/stop')
async def stop_connected_clients_stream():
    """Stop the connected clients monitoring task."""
    await stop_monitoring()
    return {"status": "success", "message": "Monitoring stopped"}

async def stop_monitoring():
    """Stop the monitoring task if there are no active connections."""
    global connected_clients_monitor, connected_clients_instance, active_connections
    
    # Reset active connections counter to ensure we don't have negative values
    if active_connections <= 0:
        active_connections = 0
        
        if connected_clients_instance:
            logger.info("Stopping connected clients monitoring task")
            connected_clients_instance.stop_monitoring()
            connected_clients_instance = None
        
        if connected_clients_monitor and not connected_clients_monitor.done():
            logger.info("Cancelling connected clients monitoring task")
            connected_clients_monitor.cancel()
            try:
                await connected_clients_monitor
            except asyncio.CancelledError:
                pass
            connected_clients_monitor = None
            
            logger.info("Connected clients monitoring stopped")

# Cleanup on shutdown
@takserver_api.on_event("shutdown")
async def shutdown_event():
    await stop_monitoring()
