# Transfer System Documentation

## Overview
The transfer system is designed to facilitate file transfers between a computer and Android devices using ADB (Android Debug Bridge). It consists of two main components:
- `transfer.py`: The main transfer manager that handles device monitoring and file transfer orchestration
- `adb_controller.py`: A specialized controller for ADB-specific operations

## Key Features

### Device Management
- Real-time device monitoring
- Automatic device detection and connection status updates
- Device name resolution from device IDs
- Support for multiple connected devices

### File Transfer Capabilities
- Bulk file transfers to multiple devices simultaneously
- Progress tracking per device and per file
- Automatic destination path selection based on file types
- Support for various file types:
  - Images (jpg, jpeg, png, tif, tiff, sid) → `/storage/emulated/0/atak/imagery`
  - Certificates (p12, pem, crt, key) → `/storage/emulated/0/atak/certs`
  - ZIP files → `/storage/emulated/0/atak/tools/datapackage`
  - Preferences → `/storage/emulated/0/atak/config/prefs`

### Real-time Status Updates
- Live transfer progress updates
- Device connection state changes
- Error reporting and handling
- Transfer state management (starting, running, completed, failed)

## System Flow

### 1. Device Connection Flow
1. System starts monitoring for devices
2. When a device connects:
   - Device ID is detected
   - Device name is resolved
   - Device state is tracked
   - Connection status is reported

### 2. Transfer Process Flow
1. Transfer is initiated
2. System checks for files in temp directory
3. For each connected device:
   - Creates necessary directories on device
   - Transfers files one by one
   - Tracks progress for each file
   - Updates overall transfer status
4. On completion:
   - Reports success/failure
   - Updates device status
   - Maintains transfer history

### 3. Error Handling Flow
- Device disconnection during transfer
- Failed file transfers
- Directory creation failures
- Process termination handling

## Component Relationship

### RapidFileTransfer (transfer.py)
- **Primary Role**: High-level transfer management
- **Responsibilities**:
  - Device state tracking
  - Transfer orchestration
  - Progress monitoring
  - Event emission
  - Temporary file management

### ADBController (adb_controller.py)
- **Primary Role**: Low-level ADB operations
- **Responsibilities**:
  - Direct device communication
  - File pushing operations
  - Directory creation
  - Process management
  - Device monitoring

## Communication Flow
1. RapidFileTransfer initiates operations
2. ADBController executes ADB commands
3. Progress updates flow from ADBController to RapidFileTransfer
4. RapidFileTransfer emits events to the client

## Technical Details

### Event System
- SSE (Server-Sent Events) for real-time updates
- Event types:
  - transfer_update: Transfer status and progress
  - device_update: Device connection and state changes
  - file_update: File system changes

### State Management
- Device states tracked per device ID
- Transfer progress tracked separately
- File transfer history maintained
- Process tracking for cleanup

### Error Recovery
- Automatic retry capability
- Graceful failure handling
- Process cleanup on interruption
- State preservation for failed transfers

## Best Practices
1. Always monitor device connection status
2. Track transfer progress
3. Clean up processes properly
4. Handle errors gracefully
5. Maintain accurate state information 