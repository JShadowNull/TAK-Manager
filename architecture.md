# TAK Manager Architecture: HTTP APIs and WebSocket Events

## Overview

The TAK Manager application uses a hybrid approach combining HTTP APIs for operations and WebSocket events for real-time status updates. This separation of concerns ensures efficient communication between frontend and backend while maintaining a clear and maintainable codebase.

## Core Principles

### HTTP APIs
- Handle actual operations (install, uninstall, start, stop)
- Return immediate responses for operation initiation
- Manage operation state and concurrency
- Validate requests and handle errors
- Return appropriate HTTP status codes

### WebSocket Events
- Provide real-time status updates
- Track operation progress
- Emit state changes
- Handle initial state requests
- Update UI without polling

## Detailed Component Responsibilities

### Route File (`takserver_routes.py`)
The route file serves as the entry point for all operations and manages the high-level flow of the application.

1. Request Validation
```python
def validate_installation_request(request):
    # Check for required files
    # Validate form fields
    # Verify file types
    # Return (is_valid, error_message)
```

2. Operation State Management
```python
class BaseNamespace(Namespace):
    def __init__(self):
        self.operation_in_progress = False
    
    def start_operation(self):
        # Set operation flag
        # Emit initial state
    
    def end_operation(self):
        # Clear operation flag
        # Emit completion state
```

3. Initial State Handling
```python
def on_request_initial_state(self):
    # Check current system state
    # Determine operation readiness
    # Emit appropriate state
    initial_state = {
        'isOperating': False,
        'operationComplete': False,
        'status': 'ready',
        'error': None,
        'progress': 0
    }
```

4. HTTP Endpoints
```python
@takserver_bp.route('/operation-endpoint', methods=['POST'])
def handle_operation():
    # 1. Check operation_in_progress
    if namespace.operation_in_progress:
        return error_response(409)
    
    # 2. Validate request
    is_valid, error = validate_request(request)
    if not is_valid:
        return error_response(400, error)
    
    # 3. Check system state
    if not is_ready_for_operation():
        return error_response(409)
    
    # 4. Initialize operation
    namespace.start_operation()
    
    # 5. Start background task
    thread = thread_manager.spawn(operation_task)
    
    # 6. Return immediate response
    return success_response(202)
```

### Script File (`takserver_installer.py`)
The script file handles the actual execution of operations and reports progress.

1. Progress Reporting
```python
class OperationScript:
    def update_progress(self, progress, message):
        """Update operation progress"""
        self.operation_status.emit_status(
            operation='operation_name',
            status='in_progress',
            message=message,
            details={'progress': progress}
        )
```

2. Operation Steps
```python
def main(self):
    try:
        # Phase 1: Setup (0-30%)
        self.update_progress(5, "Initial setup")
        self.setup_phase()

        # Phase 2: Configuration (30-60%)
        self.update_progress(35, "Configuration")
        self.configure_phase()

        # Phase 3: Execution (60-90%)
        self.update_progress(65, "Execution")
        self.execute_phase()

        # Phase 4: Verification (90-100%)
        self.update_progress(90, "Verification")
        self.verify_phase()

        return True
    except Exception as e:
        self.handle_error(e)
        raise
```

3. Error Handling
```python
def handle_error(self, error):
    """Handle operation errors"""
    self.operation_status.emit_status(
        operation='operation_name',
        status='error',
        message=str(error),
        details={'progress': 0}
    )
```

4. Cleanup
```python
def cleanup(self):
    """Clean up resources"""
    try:
        # Remove temporary files
        # Clean up system state
        # Reset configurations
    except Exception as e:
        self.handle_error(e)
```

## Standard Operation Flow

1. Route Layer Responsibilities
   - Validate incoming requests
   - Check operation state
   - Verify system readiness
   - Initialize operation
   - Spawn background task
   - Return immediate response
   - Handle completion/errors

2. Script Layer Responsibilities
   - Execute operation steps
   - Report progress
   - Handle errors
   - Manage resources
   - Clean up after completion
   - Maintain operation state

3. Communication Pattern
```python
# Route Layer
def handle_operation():
    # Initialize
    script = OperationScript(params)
    
    def background_task():
        try:
            success = script.main()
            namespace.emit_completion(success)
        except Exception as e:
            namespace.emit_error(str(e))
        finally:
            namespace.end_operation()
    
    thread_manager.spawn(background_task)
    return response

# Script Layer
def main(self):
    for step in self.steps:
        self.update_progress(step.progress, step.message)
        step.execute()
```

## State Management Pattern

1. Operation States
```python
class OperationStates:
    READY = 'ready'
    IN_PROGRESS = 'in_progress'
    COMPLETE = 'complete'
    ERROR = 'error'
```

2. State Transitions
```python
def handle_state_transition(self, new_state, details=None):
    self.current_state = new_state
    self.emit_status(new_state, details)
```

3. Progress Updates
```python
def update_progress(self, progress, message):
    self.emit_status(
        self.current_state,
        {
            'progress': progress,
            'message': message,
            'timestamp': current_time()
        }
    )
```

## Example Implementation: TAK Server Installation

1. Route Handler
```python
@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    # Validate request
    if not validate_installation_request(request):
        return error_response(400)
    
    # Check state
    if installer_namespace.operation_in_progress:
        return error_response(409)
    
    # Initialize
    installer = TakServerInstaller(request.params)
    installer_namespace.start_operation()
    
    # Start installation
    thread_manager.spawn(installer.main)
    
    return success_response(202)
```

2. Installation Script
```python
class TakServerInstaller:
    def main(self):
        try:
            # Setup phase
            self.update_progress(5, "Creating directories")
            self.create_working_directory()
            
            # Configuration phase
            self.update_progress(30, "Configuring server")
            self.configure_server()
            
            # Installation phase
            self.update_progress(60, "Installing components")
            self.install_components()
            
            # Verification phase
            self.update_progress(90, "Verifying installation")
            self.verify_installation()
            
            return True
        except Exception as e:
            self.handle_error(e)
            raise
```

## Best Practices

1. Route File Organization
   - Group related routes together
   - Consistent error handling
   - Clear validation methods
   - Proper state management
   - Clean request processing

2. Script File Organization
   - Clear phase separation
   - Consistent progress updates
   - Proper error handling
   - Resource management
   - Clean cleanup procedures

3. State Management
   - Clear state transitions
   - Consistent status updates
   - Proper error states
   - Progress tracking
   - Resource cleanup

4. Error Handling
   - Consistent error formats
   - Proper status codes
   - Clear error messages
   - Error recovery procedures
   - Resource cleanup

## Frontend Architecture

### Shared Hooks

1. Base Fetch Hook (`useFetch.tsx`)
```typescript
// Generic HTTP client hook
interface FetchConfig extends Omit<AxiosRequestConfig, 'validateResponse'> {
  rawResponse?: boolean;
  validateResponse?: (data: any) => ValidationResult;
}

function useFetch(): FetchHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // HTTP methods with built-in error handling and loading states
  const get = useCallback(<T = any>(endpoint: string, _data?: never, config: FetchConfig = {}) => {
    setLoading(true);
    // Implementation...
  }, []);

  const post = useCallback(<T = any>(endpoint: string, data?: any, config: FetchConfig = {}) => {
    setLoading(true);
    // Implementation...
  }, []);

  return {
    get,
    post,
    put,
    delete: del,
    loading,
    error,
    clearError: () => setError(null)
  };
}
```

2. Base Socket Hook (`useSocket.tsx`)
```typescript
// Socket namespaces definition
const SOCKET_NAMESPACES = [
  '/takserver-status',
  '/takserver-installer',
  '/takserver-uninstall'
] as const;

// Socket store for managing connections
const socketStore: SocketStore = {
  sockets: {},
  subscribers: {},
  states: {},
  
  initialize() {
    // Initialize sockets with proper configuration
    // Handle reconnection, errors, etc.
  },
  
  subscribe(namespace: SocketNamespace, subscriber: Subscriber) {
    // Handle subscription and state updates
  }
};

// Generic socket hook
function useSocket(
  namespace: SocketNamespace,
  options: UseSocketOptions = {}
): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState(options.initialState || {});

  // Socket lifecycle management
  useEffect(() => {
    // Subscribe to socket
    // Handle cleanup
  }, [namespace]);

  return {
    socket,
    isConnected,
    error,
    emit,
    on,
    state,
    updateState
  };
}
```

### Type Definitions (`types/index.ts`)
```typescript
// Form validation schema
export const formSchema = z.object({
  docker_zip_file: z.instanceof(File)
    .refine((file) => file.name.endsWith('.zip'), "File must be a ZIP file")
    .refine((file) => file.size <= 5000000000, "File size must be less than 5GB"),
  postgres_password: z.string().min(8),
  certificate_password: z.string().min(8),
  // ... other fields
});

// Socket state interfaces
export interface InstallState {
  isInstalling: boolean;
  installationComplete: boolean;
  installationSuccess: boolean;
  installationError: string | undefined;
  status: string | undefined;
  operationInProgress: boolean;
  progress: number;
}

export interface UninstallState {
  isUninstalling: boolean;
  uninstallComplete: boolean;
  uninstallSuccess: boolean;
  // ... other fields
}
```

### Feature-Specific Hooks

1. Installation Hook (`useInstallSocket.ts`)
```typescript
function useInstallSocket() {
  // Use base socket hook with install namespace
  const socket = useSocket('/takserver-installer', {
    eventHandlers: {
      status_update: (data, { updateState }) => {
        updateState(data);
      },
      // ... other event handlers
    },
    initialState: {
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      // ... initial state
    }
  });

  return socket;
}
```

## Frontend Best Practices

1. Hook Organization
   - Use shared base hooks (`useFetch`, `useSocket`)
   - Create feature-specific hooks
   - Handle cleanup properly
   - Maintain type safety
   - Centralize error handling

2. Type Safety
   - Use Zod for runtime validation
   - Define clear interfaces
   - Share types between components
   - Validate API responses
   - Type socket events

3. State Management
   - Centralize socket state
   - Handle reconnection
   - Track operation progress
   - Manage loading states
   - Handle errors consistently

4. Component Structure
   - Use typed props
   - Separate concerns
   - Handle loading/error states
   - Use proper cleanup
   - Follow React best practices

## Example Usage

1. Component Implementation
```typescript
function TakServerInstaller() {
  const { post } = useFetch();
  const {
    state: installState,
    error,
    emit
  } = useInstallSocket();

  const handleInstall = async (data: FormData) => {
    try {
      await post('/api/takserver/install-takserver', data);
      // Socket will handle progress updates
    } catch (error) {
      // Handle errors
    }
  };

  return (
    <div>
      <InstallationForm
        onSubmit={handleInstall}
        disabled={installState.isInstalling}
      />
      <InstallProgress
        progress={installState.progress}
        status={installState.status}
        error={error}
      />
    </div>
  );
}
```

2. Form Validation
```typescript
function InstallationForm({ onSubmit }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      postgres_password: '',
      certificate_password: '',
      // ... other defaults
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields with validation */}
    </form>
  );
}
```

## Frontend-Backend Integration

1. Socket Events
```typescript
// Backend emits
self.operation_status.emit_status(
  operation='install',
  status='in_progress',
  message=message,
  details={'progress': progress}
)

// Frontend receives
socket.on('status_update', (update) => {
  updateState({
    progress: update.details.progress,
    status: update.status,
    message: update.message
  });
});
```

2. HTTP Operations
```typescript
// Backend endpoint
@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    # Handle installation

// Frontend call
const response = await post('/api/takserver/install-takserver', formData);
```

## Operation Status Management

### OperationStatus Class
The `OperationStatus` class provides a centralized way to manage and emit operation states and progress updates through WebSocket events.

1. Core Functionality
```python
class OperationStatus:
    def __init__(self, socketio=None, namespace=None):
        self.socketio = socketio
        self.namespace = namespace
        self.current_operation = None
        self.last_event_data = None
        self.last_event_time = 0
        self.debounce_interval = 0.5  # 500ms debounce
```

2. Status Emission
```python
def emit_status(self, operation, status, message, details=None, progress=None):
    """
    Emit operation status with debouncing
    - operation: Operation identifier
    - status: Current status (started, in_progress, complete, failed)
    - message: User-friendly status message
    - details: Additional operation-specific data
    - progress: Numerical progress (0-100)
    """
    event_data = {
        'operation': operation,
        'status': status,
        'message': message,
        'details': details,
        'progress': progress
    }
    
    # Debounce emissions to prevent flooding
    if self._should_emit(event_data):
        socketio.emit('operation_status', event_data, namespace=self.namespace)
```

3. Operation Lifecycle
```python
# Start operation
def start_operation(self, operation, message=None, details=None):
    self.current_operation = operation
    self.emit_status(
        operation=operation,
        status='started',
        message=message or f"{operation.capitalize()}ing...",
        details=details
    )

# Update progress
def update_progress(self, operation, progress, message=None, details=None):
    if self.current_operation == operation:
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message,
            details=details,
            progress=progress
        )

# Complete operation
def complete_operation(self, operation, message=None, details=None):
    self.emit_status(
        operation=operation,
        status='complete',
        message=message,
        details=details
    )
    self.current_operation = None

# Handle failure
def fail_operation(self, operation, error_message, details=None):
    self.emit_status(
        operation=operation,
        status='failed',
        message=error_message,
        details=details
    )
    self.current_operation = None
```

### Usage Patterns

1. Script Integration
```python
class TakServerInstaller:
    def __init__(self, params):
        self.operation_status = OperationStatus(namespace='/takserver-installer')
        
    def main(self):
        try:
            # Start installation
            self.operation_status.start_operation(
                operation='install',
                message="Starting TAK Server installation"
            )
            
            # Update progress during phases
            self.operation_status.update_progress(
                operation='install',
                progress=30,
                message="Configuring server components"
            )
            
            # Complete successfully
            self.operation_status.complete_operation(
                operation='install',
                message="Installation completed successfully"
            )
            
        except Exception as e:
            # Handle failure
            self.operation_status.fail_operation(
                operation='install',
                error_message=str(e)
            )
            raise
```

2. Complex Operations (e.g., Certificate Management)
```python
def create_certificates(self, users):
    try:
        total_certs = len(users)
        self.operation_status.start_operation(
            operation='certificate_operation',
            message=f'Starting certificate creation for {total_certs} users',
            details={
                'total_certs': total_certs,
                'completed_certs': 0
            }
        )
        
        for idx, user in enumerate(users):
            # Update progress for each certificate
            self.operation_status.update_progress(
                operation='certificate_operation',
                progress=int((idx / total_certs) * 100),
                message=f'Processing certificate for {user}',
                details={
                    'current_user': user,
                    'completed_certs': idx
                }
            )
            
        self.operation_status.complete_operation(
            operation='certificate_operation',
            message=f'Successfully created {total_certs} certificates'
        )
        
    except Exception as e:
        self.operation_status.fail_operation(
            operation='certificate_operation',
            error_message=f'Certificate creation failed: {str(e)}'
        )
        raise
```

### Best Practices

1. Operation Tracking
   - Use consistent operation identifiers
   - Track current operation state
   - Handle one operation at a time
   - Clean up on completion/failure
   - Implement proper error handling

2. Progress Updates
   - Provide meaningful progress percentages
   - Include descriptive messages
   - Add relevant details
   - Use appropriate status codes
   - Implement debouncing

3. Error Handling
   - Provide clear error messages
   - Include error details
   - Clean up resources
   - Reset operation state
   - Maintain consistency

4. Status Messages
   - Use clear, concise messages
   - Include progress indicators
   - Provide user-friendly updates
   - Maintain consistency
   - Follow naming conventions

### Frontend Integration

1. Socket Event Handling
```typescript
const useOperationSocket = (namespace: string) => {
  const socket = useSocket(namespace);
  
  useEffect(() => {
    socket.on('operation_status', (update) => {
      const {
        operation,
        status,
        message,
        details,
        progress
      } = update;
      
      // Update UI based on operation status
      switch (status) {
        case 'started':
          setIsOperating(true);
          break;
        case 'in_progress':
          updateProgress(progress);
          break;
        case 'complete':
          handleCompletion();
          break;
        case 'failed':
          handleError(message);
          break;
      }
    });
  }, [socket]);
  
  return socket;
};
```

2. Progress Display
```typescript
function OperationProgress({ operation }) {
  const { state } = useOperationSocket(`/${operation}-namespace`);
  
  return (
    <div>
      <ProgressBar value={state.progress} />
      <StatusMessage>{state.message}</StatusMessage>
      {state.status === 'failed' && (
        <ErrorMessage>{state.error}</ErrorMessage>
      )}
    </div>
  );
}
```

### Example: Complete Operation Flow

1. Route Handler
```python
@app.route('/start-operation', methods=['POST'])
def start_operation():
    # Initialize operation status
    operation_status = OperationStatus(namespace='/operation-namespace')
    
    def background_task():
        try:
            # Start operation
            operation_status.start_operation('custom_operation')
            
            # Execute phases
            for phase in phases:
                operation_status.update_progress(
                    'custom_operation',
                    phase.progress,
                    f"Executing {phase.name}"
                )
                phase.execute()
            
            # Complete operation
            operation_status.complete_operation('custom_operation')
            
        except Exception as e:
            operation_status.fail_operation('custom_operation', str(e))
    
    thread_manager.spawn(background_task)
    return jsonify({'status': 'started'})
```

2. Frontend Component
```typescript
function OperationComponent() {
  const { post } = useFetch();
  const { state } = useOperationSocket('/operation-namespace');
  
  const startOperation = async () => {
    try {
      await post('/start-operation');
      // Socket will handle progress updates
    } catch (error) {
      // Handle HTTP error
    }
  };
  
  return (
    <div>
      <Button
        onClick={startOperation}
        disabled={state.status === 'in_progress'}
      >
        Start Operation
      </Button>
      <ProgressDisplay
        progress={state.progress}
        message={state.message}
        status={state.status}
      />
    </div>
  );
}
```

## Conclusion

This architecture:
1. Uses shared, typed hooks for consistency
2. Maintains strong type safety
3. Centralizes socket management
4. Provides clean component patterns
5. Handles errors gracefully
6. Ensures proper cleanup 