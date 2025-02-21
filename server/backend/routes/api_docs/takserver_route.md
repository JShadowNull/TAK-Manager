# TAK Server Management API Documentation

## Overview
REST API for managing TAK Server lifecycle in Docker environments. Provides installation, control, monitoring, and real-time updates.

**Base Path**: `/api/takserver`  

---

## Installation Endpoints

### 1. Install TAK Server
`POST /install-takserver`  
Deploys new TAK Server instance with Docker.

**Request Format** (multipart/form-data):
```bash
curl -X POST \
  -F "docker_zip_file=@docker-configs.zip" \
  -F "postgres_password=StrongPass123!" \
  -F "certificate_password=CertPass456@" \
  -F "organization=Department of Defense" \
  -F "state=Virginia" \
  -F "city=Reston" \
  -F "organizational_unit=IT Department" \
  -F "name=TAK-PROD-01" \
  http://localhost:8000/api/takserver/install-takserver
```

**Parameters**:
| Field | Type | Description |
|-------|------|-------------|
| `docker_zip_file` | File | TAK Server Docker ZIP file |
| `postgres_password` | String | 8+ character PostgreSQL password |
| `certificate_password` | String | 8+ character certificate password |
| `organization` | String | Organization name for certs |
| `state` | String | State/province for certs |
| `city` | String | City for certs |
| `organizational_unit` | String | Organizational unit |
| `name` | String | Server identifier |

**Process Flow**:
1. Validate and save Docker configuration
2. Generate security certificates
3. Initialize PostgreSQL database
4. Start Docker containers

---

### 2. Uninstall TAK Server
`POST /uninstall-takserver`  
Completely removes TAK Server installation.

**Response**:
```json
// Success
HTTP 200 OK

// Error
{
  "detail": "Uninstallation failed: Docker containers still running"
}
```

**Cleanup Process**:
1. Stop containers
2. Remove Docker resources
3. Delete configuration files

---

## Control Endpoints

### 3. Container Management

| Endpoint | Method | Action | Success Response |
|----------|--------|--------|------------------|
| `/start-takserver` | POST | Start containers | `{"status": "success", "message": "Containers started"}` |
| `/stop-takserver` | POST | Stop containers | `{"status": "success", "message": "Containers stopped"}` |
| `/restart-takserver` | POST | Restart containers | `{"status": "success", "message": "Containers restarted"}` |

**Concurrency Limit**: Only one control operation can execute at a time

---

## Monitoring Endpoints

### 4. Status Checks

**GET `/takserver-status`**  
Current installation state:
```json
{
  "isInstalled": true,
  "isRunning": true,
  "version": "5.3-release-23"
}
```

**GET `/webui-status`**  
Web interface health:
```json
{
  "status": "available",  // "available"|"unavailable"|"error"
  "message": "Service responding",
  "error": null,
  "response_time": 1.23,
  "ssl_valid": true
}
```

---

## Real-time Updates (Server-Sent Events)

### Stream Endpoints

| Endpoint | Events | Description |
|----------|--------|-------------|
| `/install-status-stream` | `install-status`, `terminal` | Installation progress |
| `/uninstall-status-stream` | `uninstall-status`, `terminal` | Uninstallation progress |
| `/server-status-stream` | `server-status`, `ping` | System status updates |

**Event Types**:
1. **Status Events** (JSON):
```json
{
  "event": "install-status",
  "data": {
    "progress": 65,
    "current_step": "Configuring certificates"
  }
}
```

2. **Terminal Output** (Raw text):
```json
{
  "event": "terminal",
  "data": "INFO: Starting PostgreSQL container..."
}
```

3. **Ping Events** (Keep-alive):
```json
{"event": "ping", "data": ""}
```

**Client Implementation**:
```javascript
const eventSource = new EventSource('/api/takserver/install-status-stream', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch(event.type) {
    case 'install-status':
      updateProgressBar(data.progress);
      break;
    case 'terminal':
      appendToConsole(data.message);
      break;
  }
};
```

---

## Error Handling

**Common Status Codes**:
- `409 Conflict`: Concurrent operations blocked
- `500 Server Error`: Operation failure details

**Error Response Format**:
```json
{
  "detail": "Certificate generation failed",
  "debug_info": {
    "step": "certificate_creation",
    "timestamp": "2024-02-15T14:23:18Z"
  }
}
```

---

## Best Practices
 **SSE Connections**:
   - Handle automatic reconnects
   - Use ping events to detect dead connections
   - Close streams when operations complete

> **Note**: All endpoints require `Content-Type: multipart/form-data` for file uploads or `application/json` for other requests. 