# Tak-Manager Project Structure and Setup

## Project Overview
Tak-Manager is a client-server application with a React frontend and Flask backend.

## Current Architecture

### Directory Structure
```
.
├── client/           # React frontend
│   ├── src/         # Frontend source code
│   └── vite.config.ts # Vite configuration
├── server/          # Flask backend
│   ├── app_dev.py   # Development server
│   └── requirements.txt # Python dependencies
```

### Backend (server/)
- **Framework**: Flask with Flask-SocketIO
- **Key Dependencies**:
  - Flask 3.1.0
  - Flask-SocketIO 5.5.0
  - Flask-CORS 5.0.0
  - watchdog 6.0.0
- **Development Server**: Currently runs on default Flask port (to be changed)
- **Notable Features**:
  - WebSocket support through Flask-SocketIO
  - Cross-origin resource sharing enabled
  - File watching capabilities

### Frontend (client/)
- **Framework**: React with Vite
- **Build Tool**: Vite
- **Development Server**:
  - Port: 5173
  - CORS enabled
  - HMR (Hot Module Replacement) enabled
- **Build Configuration**:
  - Output directory: client/dist
  - Source maps enabled
  - Chunk splitting for optimized loading
  - Tailwind CSS for styling

### Current Deployment
- Currently running directly on the host system
- Frontend and backend are run separately in development
- Backend uses host system's Python environment
- Frontend uses Node.js environment on the host

## System Requirements
- Python 3.x with pip
- Node.js and npm/yarn

## Development Setup
1. Backend:
   ```bash
   cd server
   pip install -r requirements.txt
   python app_dev.py
   ```

2. Frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Migration Changes for Containerization

### Dependencies to Remove
1. macOS-specific packages:
   - pyobjc-core
   - pyobjc-framework-Cocoa
   - pyobjc-framework-Quartz
   - pyobjc-framework-Security
   - pyobjc-framework-WebKit
2. Desktop integration:
   - pywebview (application will be browser-based)

### Container Configuration

#### Docker Images & Tags
1. Backend Image:
   - Name: `tak-manager-backend`
   - Tags:
     - `dev`: Development version
     - `prod`: Production version
     - `latest`: Points to latest stable

2. Frontend Image:
   - Name: `tak-manager-frontend`
   - Tags:
     - `dev`: Development version
     - `prod`: Production version
     - `latest`: Points to latest stable

#### Container Names
1. Development Environment:
   - Backend: `tak-manager-backend-dev`
   - Frontend: `tak-manager-frontend-dev`

2. Production Environment:
   - Backend: `tak-manager-backend-prod`
   - Frontend: `tak-manager-frontend-prod`

#### Container Privileges
1. Required Access:
   - Privileged mode enabled
   - Docker socket mount: `/var/run/docker.sock:/var/run/docker.sock`
   - Additional system mounts as needed

#### WebSocket Configuration
1. Development Mode:
   - Keep existing WebSocket configuration
   - Update URLs to use container hostnames
   - Maintain current socket event structure
   - CORS settings for container communication

2. Production Mode:
   - Optimized WebSocket configuration
   - Secure WebSocket connections (wss://)
   - Production-ready CORS settings

#### Networking
1. Docker Network:
   - Name: `tak-manager-network`
   - Type: bridge
   - Internal communication between containers
   - External access configuration

#### Volume Configuration
1. Development Volumes:
   - Source code mounting for hot-reload
   - Docker socket
   - Persistent data storage

2. Production Volumes:
   - Docker socket
   - Logs
   - Configuration files
   - Persistent data storage

#### Logging Configuration
1. Development Mode:
   - Console output
   - Debug level logging
   - Hot-reload logs

2. Production Mode:
   - File-based logging
   - Log rotation
   - Error reporting
   - Performance metrics

#### Build Process
1. Multi-stage builds:
   - Development stage
   - Production stage
   - Optimization steps

2. Build Arguments:
   - Node version
   - Python version
   - Build-time configurations
   - Environment-specific variables

#### Resource Management
1. Container Resources:
   - Memory limits
   - CPU allocation
   - Restart policies
   - Health check intervals

2. Storage:
   - Volume cleanup policies
   - Temp file management
   - Cache management

#### Backup & Recovery
1. Volume backup strategy
2. Container state persistence
3. Recovery procedures

### Backend Changes Required
1. Port Configuration:
   - Remove hardcoded port 5000
   - Implement dynamic port selection or use environment variable
   - Suggested port range: 8000-8999 (commonly used for web services)
2. Remove pywebview integration:
   - Replace any desktop window management with pure web endpoints
   - Update any system-level interactions to be web-based
3. Update CORS settings for containerized environment

### Frontend Changes Required
1. Update API endpoint configuration to use environment variables
2. Ensure all desktop-specific code is removed
3. Update WebSocket connection handling for containerized setup

## Notes for Containerization
Key considerations for Docker conversion:
1. Backend container will need Python environment with all requirements
2. Frontend container will need Node.js environment
3. Need to handle communication between containers
4. Consider volume mounting for development
5. Environment variables for configuration:
   - Backend port
   - Frontend API endpoints
   - CORS settings
   - WebSocket URLs (dev/prod)
   - Container mode (dev/prod)
6. Network configuration for container communication
7. Health checks for both services
8. Security considerations:
   - Docker socket access
   - Container privileges
   - Network isolation
9. Development vs Production modes:
   - Different container configurations
   - Environment-specific settings
   - Debug/logging levels 
10. Monitoring & Maintenance:
    - Container health monitoring
    - Resource usage tracking
    - Log aggregation
    - Backup scheduling
11. CI/CD Considerations:
    - Build pipeline configuration
    - Testing environment setup
    - Deployment strategies
    - Version control integration
12. Documentation Requirements:
    - Setup instructions
    - Environment variables
    - Build processes
    - Troubleshooting guides 