from backend.routes.socketio import socketio  # Import the global socketio instance
import time  # Add time import

class OperationStatus:
    def __init__(self, socketio=None, namespace=None):
        self.socketio = socketio
        self.namespace = namespace
        self.current_operation = None
        self.last_event_data = None
        self.last_event_time = 0
        self.debounce_interval = 0.5  # 500ms debounce
        print(f"[OperationStatus] Initialized with socketio: {bool(socketio)}, namespace: {namespace}")

    def _should_emit(self, event_data):
        """Check if we should emit this event based on debouncing and data changes."""
        current_time = time.time()  # Use time.time() instead of eventlet.time.time()
        
        # Always emit if it's been longer than debounce_interval
        if current_time - self.last_event_time > self.debounce_interval:
            return True
            
        # Don't emit if the data hasn't changed
        if self.last_event_data == event_data:
            return False
            
        return True

    def emit_status(self, operation, status, message, details=None, progress=None):
        """Emit operation status update (general method for all operations)"""
        event_data = {
            'operation': operation,
            'status': status,
            'message': message
        }
        
        if details is not None:
            event_data['details'] = details
        if progress is not None:
            event_data['progress'] = progress
        
        # Check if we should emit this event
        if not self._should_emit(event_data):
            return
            
        print(f"[OperationStatus] Emitting operation status: {event_data}")
        
        try:
            socketio.emit('operation_status', event_data, namespace=self.namespace)
            self.last_event_data = event_data
            self.last_event_time = time.time()  # Use time.time() here too
        except Exception as e:
            print(f"[OperationStatus] Error emitting status: {str(e)}")

    def start_operation(self, operation, message=None, details=None):
        """Start a general operation"""
        print(f"[OperationStatus] Starting operation: {operation}")
        if self.current_operation == operation:
            return
        self.current_operation = operation
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message or f"{operation.capitalize()}ing...",
            details=details
        )

    def complete_operation(self, operation, message=None, details=None):
        """Complete a general operation"""
        print(f"[OperationStatus] Completing operation: {operation}")
        if self.current_operation != operation:
            return
        self.emit_status(
            operation=operation,
            status='complete',
            message=message or f"{operation.capitalize()} completed",
            details=details
        )
        self.current_operation = None

    def fail_operation(self, operation, error_message, details=None):
        """Fail a general operation"""
        print(f"[OperationStatus] Failed operation: {operation} - {error_message}")
        if self.current_operation != operation:
            return
        self.emit_status(
            operation=operation,
            status='failed',
            message=error_message,
            details=details
        )
        self.current_operation = None

    def update_progress(self, operation, progress, message=None, details=None):
        """Update general operation progress"""
        if self.current_operation != operation:
            return
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

    # Certificate List Updates
    def emit_certificates_update(self, certificates):
        """Emit updated certificate list"""
        try:
            socketio.emit('certificates_data', {'certificates': certificates}, namespace=self.namespace)
        except Exception as e:
            print(f"[OperationStatus] Error emitting certificates update: {str(e)}")

    def emit_certificates_data(self, certificates):
        """Emit initial certificate list data"""
        try:
            # Emit both initial_state and certificates_data for consistency
            socketio.emit('initial_state', {'certificates': certificates}, namespace=self.namespace)
            socketio.emit('certificates_data', {'certificates': certificates}, namespace=self.namespace)
            print(f"[OperationStatus] Emitted certificates data with {len(certificates)} certificates")
        except Exception as e:
            print(f"[OperationStatus] Error emitting certificates data: {str(e)}")

    # Certificate Creation Operations
    def start_cert_creation(self, mode='single', total_certs=1):
        """Start certificate creation operation"""
        self.current_operation = 'certificate_operation'
        self.emit_status(
            operation='certificate_operation',
            status='in_progress',
            message=f'Starting {mode} certificate creation',
            details={
                'mode': mode,
                'total_certs': total_certs,
                'completed_certs': 0
            },
            progress=0
        )

    def update_cert_creation(self, current_cert, step, step_progress, completed_certs, total_certs):
        """Update certificate creation progress"""
        overall_progress = int((completed_certs / total_certs) * 100)
        self.emit_status(
            operation='certificate_operation',
            status='in_progress',
            message=f'Processing certificate {completed_certs + 1} of {total_certs}',
            details={
                'total_certs': total_certs,
                'completed_certs': completed_certs,
                'current_cert': {
                    'username': current_cert,
                    'step': step,
                    'step_progress': step_progress
                }
            },
            progress=overall_progress
        )

    def complete_cert_creation(self, total_certs, results=None):
        """Complete certificate creation operation"""
        self.emit_status(
            operation='certificate_operation',
            status='complete',
            message=f'Successfully created {total_certs} certificate(s)',
            details={
                'total_certs': total_certs,
                'completed_certs': total_certs,
                'results': results
            },
            progress=100
        )
        self.current_operation = None

    def fail_cert_creation(self, message, completed_certs=0, total_certs=0, results=None):
        """Fail certificate creation operation"""
        self.emit_status(
            operation='certificate_operation',
            status='failed',
            message=message,
            details={
                'total_certs': total_certs,
                'completed_certs': completed_certs,
                'results': results
            },
            progress=int((completed_certs / total_certs) * 100) if total_certs > 0 else 0
        )
        self.current_operation = None

    # Certificate Deletion Operations
    def start_cert_deletion(self, total_certs):
        """Start certificate deletion operation"""
        self.current_operation = 'deletion_operation'
        self.emit_status(
            operation='deletion_operation',
            status='in_progress',
            message=f'Starting deletion of {total_certs} certificate(s)',
            details={
                'total_certs': total_certs,
                'completed_certs': 0
            },
            progress=0
        )

    def update_cert_deletion(self, current_cert, completed_certs, total_certs):
        """Update certificate deletion progress"""
        progress = int((completed_certs / total_certs) * 100)
        self.emit_status(
            operation='deletion_operation',
            status='in_progress',
            message=f'Deleting certificate {completed_certs + 1} of {total_certs}',
            details={
                'total_certs': total_certs,
                'completed_certs': completed_certs,
                'current_cert': current_cert
            },
            progress=progress
        )

    def complete_cert_deletion(self, total_certs):
        """Complete certificate deletion operation"""
        self.emit_status(
            operation='deletion_operation',
            status='complete',
            message=f'Successfully deleted {total_certs} certificate(s)',
            details={
                'total_certs': total_certs,
                'completed_certs': total_certs
            },
            progress=100
        )
        self.current_operation = None

    def fail_cert_deletion(self, message, completed_certs=0, total_certs=0):
        """Fail certificate deletion operation"""
        self.emit_status(
            operation='deletion_operation',
            status='failed',
            message=message,
            details={
                'total_certs': total_certs,
                'completed_certs': completed_certs
            },
            progress=int((completed_certs / total_certs) * 100) if total_certs > 0 else 0
        )
        self.current_operation = None