# OTA Updates Documentation

## HTTP Endpoints

### Initial Configuration
- **Endpoint:** `POST /ota-configure`
- **Purpose:** Initial OTA server configuration and setup
- **Request:**
  ```typescript
  // Multipart form data
  {
    ota_zip_file: File  // ZIP file containing OTA configuration files
  }
  ```
- **Response:**
  ```typescript
  {
    success: boolean,
    update_id: string,
    message: string,
    status: 'pending',
    progress: 0
  }
  ```

### Plugin Update
- **Endpoint:** `POST /ota-update`
- **Purpose:** Update OTA plugins only
- **Request:**
  ```typescript
  // Multipart form data
  {
    ota_zip_file: File  // ZIP file containing plugin files
  }
  ```
- **Response:**
  ```typescript
  {
    success: boolean,
    update_id: string,
    message: string,
    status: 'pending',
    progress: 0
  }
  ```

### Progress Tracking
- **Endpoint:** `GET /ota-update-progress/<update_id>`
- **Purpose:** Track progress of any OTA operation
- **Response:**
  ```typescript
  {
    success: boolean,
    status: 'idle' | 'in_progress' | 'complete' | 'error' | 'not_found',
    progress: number,  // 0-100
    message: string,
    error?: string    // Present only if status is 'error'
  }
  ```

## WebSocket Events

The OTA update system uses WebSocket connections only for streaming terminal output.

### Connection
- **Namespace:** `/ota-update`
- **Events:**
  - Connect: Automatic on WebSocket connection
  - Disconnect: Automatic on WebSocket disconnection

## Implementation Guide

1. **Starting an Operation:**
   - Upload ZIP file to either `/ota-configure` or `/ota-update`
   - Store the returned `update_id` for progress tracking

2. **Tracking Progress:**
   - Poll `/ota-update-progress/<update_id>` periodically
   - Continue polling until:
     - `status` is 'complete' (success)
     - `status` is 'error' (failure)
     - `status` is 'not_found' (operation expired/not found)

3. **Terminal Output:**
   - Connect to WebSocket namespace `/ota-update`
   - Terminal output will be automatically streamed
   - No manual event handling required

## Error Handling

Common error responses:
- **400 Bad Request:**
  - "No file provided"
  - "No file selected"
  - "Invalid file type. Please upload a ZIP file"
- **404 Not Found:**
  - "Update not found"
- **500 Internal Server Error:**
  - Generic server errors with error message

## Progress States

1. **Initial State:**
   - `status`: 'pending'
   - `progress`: 0

2. **During Operation:**
   - `status`: 'in_progress'
   - `progress`: 0-100
   - `message`: Current operation status

3. **Completion:**
   - Success:
     - `status`: 'complete'
     - `progress`: 100
     - `message`: "Operation completed successfully"
   - Error:
     - `status`: 'error'
     - `progress`: Last recorded progress
     - `error`: Error message
     - `success`: false 