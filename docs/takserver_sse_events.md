# TAK Server Installation SSE Events Documentation

All events are published with `type='takserver_install'`

## Event Structure
```typescript
interface SSEEvent {
  status: 'in_progress' | 'complete' | 'error';
  operation: 'install' | 'rollback';
  message: string;
  progress: number;  // 0-100
  error?: string;    // Only present for error status
}
```

## Installation Process Events

### Installation Start
```json
{
  "status": "in_progress",
  "operation": "install",
  "message": "Starting TAK Server installation",
  "progress": 0
}
```

### Installation Progress Updates
Progress updates are sent at key points (5%, 10%, 35%, 40%, 45%, 50%, 55%, 70%, 75%, 85%, 90%, 95%, 97%, 98%):
```json
{
  "status": "in_progress",
  "operation": "install",
  "message": "[Current step description]",
  "progress": [percentage]
}
```

### Installation Complete
```json
{
  "status": "complete",
  "operation": "install",
  "message": "Installation complete",
  "progress": 100
}
```

### Installation Error
```json
{
  "status": "error",
  "operation": "install",
  "message": "[Error description]",
  "error": "[Error details]",
  "progress": 0
}
```

## Stop and Rollback Events

### Stop Initiated
When user clicks stop and waiting for current step to complete:
```json
{
  "status": "in_progress",
  "operation": "rollback",
  "message": "Waiting for installation to stop",
  "progress": 0
}
```

### Rollback Progress
Rollback sends progress updates at key points (0%, 25%, 50%, 75%, 90%, 100%):
```json
{
  "status": "in_progress",
  "operation": "rollback",
  "message": "[Current rollback step]",
  "progress": [percentage]
}
```

### Rollback Error
```json
{
  "status": "error",
  "operation": "rollback",
  "message": "Rollback error: [error description]",
  "error": "[Error details]",
  "progress": 0
}
```

## Frontend Implementation Guide

### Button States

#### Install Button
- Disabled when:
  - Installation is in progress (status='in_progress' && operation='install')
  - Rollback is in progress (status='in_progress' && operation='rollback')
- Loading when:
  - Installation is in progress (status='in_progress' && operation='install')

#### Stop Button
- Only visible when:
  - Installation is in progress (status='in_progress' && operation='install')
- Hidden in all other states:
  - When idle (status='idle')
  - During rollback (operation='rollback')
  - When complete (status='complete')
  - On error (status='error')
- When visible, button is:
  - Loading when waiting for installation to stop
  - Disabled when waiting for installation to stop

Example Stop Button Logic:
```typescript
const showStopButton = status === 'in_progress' && operation === 'install';
const isStopButtonLoading = operation === 'rollback' && message === 'Waiting for installation to stop';

return showStopButton ? (
  <Button 
    loading={isStopButtonLoading}
    disabled={isStopButtonLoading}
    onClick={handleStop}
  >
    Stop Installation
  </Button>
) : null;
```

### Progress Bar

- Always visible during installation and rollback
- Progress: Use the 'progress' value (0-100)
- Reset progress to 0 when:
  - operation changes from 'install' to 'rollback'
  - error occurs (status='error')
- Color/style can be different for:
  - Installation (operation='install')
  - Rollback (operation='rollback')
  - Error (status='error')

Example Progress Bar Logic:
```typescript
useEffect(() => {
  // Reset progress when switching from install to rollback
  if (operation === 'rollback' && previousOperation === 'install') {
    setProgress(0);
  }
  // Update progress with latest value
  setProgress(event.progress);
}, [operation, event.progress]);
```

### Status Messages
- Display the 'message' field from the events
- For errors, display both 'message' and 'error' fields

### Error Handling
- Show error state when:
  - status='error'
- Reset UI when:
  - New installation starts
  - Rollback completes

### State Management Example
```typescript
interface InstallationState {
  status: 'idle' | 'in_progress' | 'complete' | 'error';
  operation: 'install' | 'rollback' | null;
  message: string;
  progress: number;
  error?: string;
}

// Initial state
const initialState: InstallationState = {
  status: 'idle',
  operation: null,
  message: '',
  progress: 0
};
``` 