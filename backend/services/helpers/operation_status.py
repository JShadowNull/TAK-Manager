from flask_socketio import emit

class OperationStatus:
    def __init__(self, socketio=None, namespace=None):
        self.socketio = socketio
        self.namespace = namespace
        self.current_operation = None
        print(f"[OperationStatus] Initialized with socketio: {bool(socketio)}, namespace: {namespace}")

    def emit_status(self, operation, status, message, details=None, progress=None):
        """Emit operation status update"""
        event_data = {
            'operation': operation,
            'status': status,
            'message': message,
            'details': details,
            'progress': progress
        }
        
        print(f"[OperationStatus] Emitting operation status: {event_data}")
        
        try:
            if self.socketio:
                print(f"[OperationStatus] Emitting via socketio to namespace: {self.namespace}")
                self.socketio.emit('operation_status', event_data, namespace=self.namespace)
            else:
                print(f"[OperationStatus] Emitting via flask-socketio emit to namespace: {self.namespace}")
                emit('operation_status', event_data, namespace=self.namespace)
        except Exception as e:
            print(f"[OperationStatus] Error emitting status: {str(e)}")

    def start_operation(self, operation, message=None, details=None):
        """Start an operation"""
        print(f"[OperationStatus] Starting operation: {operation}")
        self.current_operation = operation
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message or f"{operation.capitalize()}ing...",
            details=details
        )

    def complete_operation(self, operation, message=None, details=None):
        """Complete an operation"""
        print(f"[OperationStatus] Completing operation: {operation}")
        self.emit_status(
            operation=operation,
            status='complete',
            message=message or f"{operation.capitalize()} completed",
            details=details
        )
        self.current_operation = None

    def fail_operation(self, operation, error_message, details=None):
        """Fail an operation"""
        print(f"[OperationStatus] Failed operation: {operation} - {error_message}")
        self.emit_status(
            operation=operation,
            status='failed',
            message=error_message,
            details=details
        )
        self.current_operation = None

    def update_progress(self, operation, progress, message=None, details=None):
        """Update operation progress"""
        print(f"[OperationStatus] Updating progress for {operation}: {progress}%")
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message or f"{operation.capitalize()}ing... ({progress}%)",
            details=details,
            progress=progress
        )

    def get_current_operation(self):
        """Get the current operation"""
        return self.current_operation