from backend.routes.socketio import socketio
from typing import Optional, Dict, Any, Literal

OperationTypes = Literal[
    'start',
    'stop',
    'restart',
    'install',
    'uninstall',
    'update',
    'configure',
    'validate'
]

StatusTypes = Literal['in_progress', 'complete', 'failed']

class OperationStatus:
    def __init__(self, namespace: str):
        """
        Initialize the OperationStatus helper.
        
        Args:
            namespace (str): The socket.io namespace to emit events to (e.g., '/takserver-status')
        """
        self.namespace = namespace

    def emit_status(
        self,
        operation: OperationTypes,
        status: StatusTypes,
        message: str,
        progress: Optional[float] = None,
        error: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Emit an operation status update.
        
        Args:
            operation (str): The type of operation (e.g., 'start', 'stop', 'install')
            status (str): Current status ('in_progress', 'complete', 'failed')
            message (str): Human-readable status message
            progress (float, optional): Progress percentage (0-100)
            error (str, optional): Error message if status is 'failed'
            details (dict, optional): Additional operation-specific details
        """
        status_data = {
            'operation': operation,
            'status': status,
            'message': message
        }

        if progress is not None:
            status_data['progress'] = float(progress)
        
        if error is not None:
            status_data['error'] = error
            
        if details is not None:
            status_data['details'] = details

        socketio.emit('operation_status', status_data, namespace=self.namespace)

    def start_operation(
        self,
        operation: OperationTypes,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Helper method to emit an operation start status."""
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message or f"Starting {operation} operation...",
            details=details
        )

    def complete_operation(
        self,
        operation: OperationTypes,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Helper method to emit an operation complete status."""
        self.emit_status(
            operation=operation,
            status='complete',
            message=message or f"{operation.capitalize()} operation completed successfully",
            details=details
        )

    def fail_operation(
        self,
        operation: OperationTypes,
        error: str,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Helper method to emit an operation failure status."""
        self.emit_status(
            operation=operation,
            status='failed',
            message=message or f"{operation.capitalize()} operation failed",
            error=error,
            details=details
        )

    def update_progress(
        self,
        operation: OperationTypes,
        progress: float,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Helper method to emit a progress update."""
        self.emit_status(
            operation=operation,
            status='in_progress',
            message=message or f"{operation.capitalize()} operation in progress...",
            progress=progress,
            details=details
        ) 