# Server-Sent Events (SSE) in Tak Manager

## Overview
Tak Manager uses Flask-SSE for real-time updates from server to client. All SSE events are handled through a single endpoint `/stream` which is registered in `__init__.py`. Different types of events are distinguished by their event type.

## Configuration

### Backend Setup (`__init__.py`)
```python
# SSE Blueprint registration
app.register_blueprint(sse, url_prefix='/stream')

# Redis configuration for SSE
app.config["REDIS_URL"] = os.environ.get('REDIS_URL', 'redis://redis:6379')
```

### Environment Variables
```bash
REDIS_URL=redis://redis:6379  # Redis URL for SSE message queue
```

## Event Types

### System Metrics
Used for sending real-time system metrics (CPU, Memory, etc.)
```python
from flask_sse import sse

def send_metrics():
    metrics = get_system_metrics()
    sse.publish(
        {"data": metrics},
        type='system_metrics'
    )
```

### Docker Status
Used for sending Docker container status updates
```python
def send_docker_status():
    status = get_docker_status()
    sse.publish(
        {"data": status},
        type='docker_status'
    )
```

### TAK Server Status
Used for sending TAK server status and updates
```python
def send_tak_status():
    status = get_tak_status()
    sse.publish(
        {"data": status},
        type='tak_status'
    )
```

## Client-Side Implementation

### Connecting to SSE Stream
```javascript
const eventSource = new EventSource('/stream');
```

### Listening for Events
```javascript
// System Metrics
eventSource.addEventListener('system_metrics', (event) => {
    const metrics = JSON.parse(event.data);
    // Update UI with metrics
});

// Docker Status
eventSource.addEventListener('docker_status', (event) => {
    const status = JSON.parse(event.data);
    // Update UI with Docker status
});

// TAK Server Status
eventSource.addEventListener('tak_status', (event) => {
    const status = JSON.parse(event.data);
    // Update UI with TAK status
});

// Error Handling
eventSource.addEventListener('error', (event) => {
    console.error('SSE connection error:', event);
    // Implement reconnection logic
});
```

## Architecture

1. **Message Queue**
   - Redis is used as the message queue backend
   - Ensures reliable message delivery
   - Handles multiple clients efficiently

2. **Event Flow**
   ```
   Server Script -> Redis -> Flask-SSE -> Client Browser
   ```

3. **Scaling**
   - Redis allows multiple Flask workers to publish events
   - Events are distributed to all connected clients
   - Horizontal scaling is supported

## Best Practices

1. **Event Types**
   - Use specific event types for different updates
   - Keep event payloads small and focused
   - Include timestamp in event data when relevant

2. **Error Handling**
   - Implement client-side reconnection logic
   - Handle Redis connection issues gracefully
   - Log SSE errors for debugging

3. **Performance**
   - Use appropriate update intervals
   - Batch updates when possible
   - Clean up event listeners when components unmount

## Example Script Usage

### System Monitor Script
```python
from flask_sse import sse
import time

def monitor_system():
    while True:
        metrics = {
            'cpu': get_cpu_usage(),
            'memory': get_memory_usage(),
            'timestamp': time.time()
        }
        sse.publish(metrics, type='system_metrics')
        time.sleep(5)  # Update every 5 seconds
```

### Docker Monitor Script
```python
from flask_sse import sse
import time

def monitor_docker():
    while True:
        containers = get_container_status()
        sse.publish(
            {'containers': containers},
            type='docker_status'
        )
        time.sleep(10)  # Update every 10 seconds
```

### TAK Server Monitor Script
```python
from flask_sse import sse
import time

def monitor_tak():
    while True:
        status = get_tak_server_status()
        sse.publish(
            {'status': status},
            type='tak_status'
        )
        time.sleep(15)  # Update every 15 seconds
```

## Security Considerations

1. **Access Control**
   - SSE endpoint is accessible to authenticated users only
   - Implement proper authentication middleware
   - Validate event types and payloads

2. **Rate Limiting**
   - Implement rate limiting for event publishing
   - Monitor client connections
   - Handle disconnections properly

## Debugging

1. **Server-Side**
   - Check Redis connection status
   - Monitor SSE publication success
   - Log event publishing attempts

2. **Client-Side**
   - Monitor EventSource connection state
   - Log received events
   - Track reconnection attempts 