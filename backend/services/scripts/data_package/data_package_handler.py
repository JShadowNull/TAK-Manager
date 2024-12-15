from backend.routes.socketio import socketio
import eventlet
from backend.services.scripts.data_package_config.data_package import DataPackage

class DataPackageOperationHandler:
    def __init__(self, data_package_instance=None):
        self.data_package = data_package_instance or DataPackage()
        self.operation_in_progress = False

    def emit_status(self, status_data):
        """Emit status updates through SocketIO"""
        socketio.emit('data_package_status', status_data, namespace='/data-package')

    def handle_configuration(self, preferences_data):
        """Handle data package configuration process"""
        try:
            self.operation_in_progress = True
            self.emit_status({
                'status': 'starting',
                'isConfiguring': True,
                'message': 'Starting data package configuration'
            })

            # Run the main configuration
            self.data_package.main(preferences_data)

            self.emit_status({
                'status': 'complete',
                'isConfiguring': False,
                'message': 'Data package configuration completed successfully'
            })

        except Exception as e:
            self.emit_status({
                'status': 'error',
                'isConfiguring': False,
                'error': str(e),
                'message': f'Configuration failed: {str(e)}'
            })
            raise

        finally:
            self.operation_in_progress = False

    def handle_stop(self):
        """Handle stopping the data package configuration"""
        try:
            self.emit_status({
                'status': 'stopping',
                'isConfiguring': False,
                'message': 'Stopping data package configuration'
            })

            self.data_package.stop()

            self.emit_status({
                'status': 'stopped',
                'isConfiguring': False,
                'message': 'Data package configuration stopped'
            })

        except Exception as e:
            self.emit_status({
                'status': 'error',
                'isConfiguring': False,
                'error': str(e),
                'message': f'Failed to stop configuration: {str(e)}'
            })
            raise 