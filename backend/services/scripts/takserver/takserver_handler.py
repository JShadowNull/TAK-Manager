from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import thread_manager
import eventlet

class TakServerOperationHandler:
    def __init__(self, tak_server):
        self.tak_server = tak_server

    def handle_installation(self):
        """Handle the installation process"""
        try:
            # Get status namespace for proper locking
            status_namespace = socketio.server.namespace_handlers.get('/takserver-status')
            if status_namespace:
                status_namespace.start_operation()

            eventlet.spawn(self._run_installation)
        except Exception as e:
            if status_namespace:
                status_namespace.end_operation()
            socketio.emit('installation_failed', {
                'success': False,
                'message': str(e)
            }, namespace='/takserver-installer')

    def handle_start(self):
        """Handle starting TAK server"""
        try:
            # Get status namespace for proper locking
            status_namespace = socketio.server.namespace_handlers.get('/takserver-status')
            if status_namespace:
                status_namespace.start_operation()

            eventlet.spawn(self._run_start)
        except Exception as e:
            if status_namespace:
                status_namespace.end_operation()
            socketio.emit('terminal_output', {
                'data': f'Error starting TAK Server: {str(e)}'
            }, namespace='/takserver-status')

    def handle_stop(self):
        """Handle stopping TAK server"""
        try:
            eventlet.spawn(self._run_stop)
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error stopping TAK Server: {str(e)}'
            }, namespace='/takserver-status')

    def handle_restart(self):
        """Handle restarting TAK server"""
        try:
            eventlet.spawn(self._run_restart)
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error restarting TAK Server: {str(e)}'
            }, namespace='/takserver-status')

    def _run_installation(self):
        """Run the installation in an eventlet greenthread"""
        try:
            success = self.tak_server.main()
            if not success:
                socketio.emit('installation_failed', {
                    'success': False,
                    'message': 'Installation failed'
                }, namespace='/takserver-installer')
        except Exception as e:
            socketio.emit('installation_failed', {
                'success': False,
                'message': str(e)
            }, namespace='/takserver-installer')
        finally:
            # Release lock when done
            status_namespace = socketio.server.namespace_handlers.get('/takserver-status')
            if status_namespace:
                status_namespace.end_operation()

    def _run_start(self):
        """Run the start operation in an eventlet greenthread"""
        try:
            success = self.tak_server.start_containers()
            if not success:
                socketio.emit('terminal_output', {
                    'data': 'Failed to start TAK Server'
                }, namespace='/takserver-status')
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error: {str(e)}'
            }, namespace='/takserver-status')
        finally:
            # Release lock when done
            status_namespace = socketio.server.namespace_handlers.get('/takserver-status')
            if status_namespace:
                status_namespace.end_operation()

    def _run_stop(self):
        """Run the stop operation in an eventlet greenthread"""
        try:
            success = self.tak_server.stop_containers()
            if not success:
                socketio.emit('terminal_output', {
                    'data': 'Failed to stop TAK Server'
                }, namespace='/takserver-status')
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error: {str(e)}'
            }, namespace='/takserver-status')

    def _run_restart(self):
        """Run the restart operation in an eventlet greenthread"""
        try:
            success = self.tak_server.restart_containers()
            if not success:
                socketio.emit('terminal_output', {
                    'data': 'Failed to restart TAK Server'
                }, namespace='/takserver-status')
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error: {str(e)}'
            }, namespace='/takserver-status') 