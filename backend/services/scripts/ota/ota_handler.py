from backend.routes.socketio import socketio
import eventlet

class OTAOperationHandler:
    def __init__(self, ota_updater):
        self.ota_updater = ota_updater

    def handle_update(self):
        """Handle the OTA update process"""
        try:
            # Get status namespace for proper locking
            status_namespace = socketio.server.namespace_handlers.get('/ota-update')
            if status_namespace:
                status_namespace.operation_in_progress = True

            eventlet.spawn(self._run_update)
        except Exception as e:
            if status_namespace:
                status_namespace.operation_in_progress = False
            socketio.emit('ota_failed', {
                'error': str(e)
            }, namespace='/ota-update')

    def _run_update(self):
        """Run the update in an eventlet greenthread"""
        try:
            success = self.ota_updater.update()
            if not success:
                socketio.emit('ota_failed', {
                    'error': 'Update failed'
                }, namespace='/ota-update')
        except Exception as e:
            socketio.emit('ota_failed', {
                'error': str(e)
            }, namespace='/ota-update')
        finally:
            # Release lock when done
            status_namespace = socketio.server.namespace_handlers.get('/ota-update')
            if status_namespace:
                status_namespace.operation_in_progress = False 