# TAKServer Setup Events Documentation

## Socket.IO Namespaces

### `/takserver-status`
Events emitted for TAK Server state monitoring.

#### Status Updates
- **Event:** `operation_status`
  - Payload:
    ```typescript
    {
      operation: 'status',
      status: 'not_installed' | 'running' | 'stopped',
      message: 'TAK Server is not installed' | 'TAK Server is running' | 'TAK Server is stopped'
    }
    ```
  - Purpose: Real-time monitoring of TAK server state
  - Note: Socket first checks if TAK server is installed. If not installed, emits 'not_installed' status. If installed, monitors running/stopped state.
  - State Flow:
    1. First checks if TAK server is installed
    2. If not installed, emits 'not_installed' status
    3. If installed, monitors and emits 'running' or 'stopped' status

## HTTP Endpoints

### Installation

#### Start Installation
- **Endpoint:** `POST /install-takserver`
- **Purpose:** Start TAK server installation
- **Request:** Multipart form data with:
  ```typescript
  {
    docker_zip_file: File,
    postgres_password: string,
    certificate_password: string,
    organization: string,
    state: string,
    city: string,
    organizational_unit: string,
    name: string
  }
  ```
- **Response:**
  ```typescript
  {
    success: boolean,
    installation_id: string,
    message: string,
    status: 'pending',
    progress: 0
  }
  ```

#### Check Installation Progress
- **Endpoint:** `GET /installation-progress/<installation_id>`
- **Purpose:** Track installation progress
- **Response:**
  ```typescript
  {
    success: boolean,
    status: 'in_progress' | 'complete' | 'error',
    progress: number, // 0-100
    message: string,
    error?: string // only present if success is false
  }
  ```

### Server Operations

#### Start/Stop/Restart Operations
- **Endpoints:** 
  - `POST /takserver-start`
  - `POST /takserver-stop`
  - `POST /takserver-restart`
- **Purpose:** Control TAK server state
- **Response:**
  ```typescript
  {
    success: boolean,
    message: string,
    status: 'pending' | 'error',
    error?: string // only present if success is false
  }
  ```

#### Check Operation Progress
- **Endpoint:** `GET /takserver-operation-progress`
- **Purpose:** Track progress of start/stop/restart operations
- **Response:**
  ```typescript
  {
    success: boolean,
    operation: 'start' | 'stop' | 'restart' | null,
    progress: number, // 0-100
    status: 'idle' | 'in_progress' | 'complete',
    error?: string // only present if success is false
  }
  ```