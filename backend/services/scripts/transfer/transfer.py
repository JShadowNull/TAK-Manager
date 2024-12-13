import os
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
from backend.services.helpers.os_detector import OSDetector
import eventlet
from pathlib import Path
from backend.services.scripts.transfer.adb_controller import ADBController


class RapidFileTransfer:
    def __init__(self):
        self.run_command = RunCommand()
        self.device_states = {}  # Single state tracking dictionary
        self.monitoring = False
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()
        self.temp_dir = os.path.join(self.working_dir, '.temp', 'rapid_transfer')
        self.is_transfer_running = False
        self.transferred_files = {}  # Track transferred files per device
        self.device_progress = {}  # Add this to track progress per device
        
        # File path mappings
        self.file_paths = {
            'imagery': '/storage/emulated/0/atak/imagery',
            'certs': '/storage/emulated/0/atak/certs',
            'zip': '/storage/emulated/0/atak/tools/datapackage',
            'prefs': '/storage/emulated/0/atak/config/prefs'
        }

        # Ensure the temp directory exists
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)

        self.adb = ADBController()

    def get_default_working_directory(self):
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type == 'windows' or os_type == 'macos':
            documents_dir = os.path.join(home_dir, 'Documents')
            # Ensure the Documents directory exists
            if not os.path.exists(documents_dir):
                os.makedirs(documents_dir)
            # Set the working directory to Documents/takserver-docker
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            # For Linux, use the home directory directly
            working_dir = os.path.join(home_dir, 'takserver-docker')
        return working_dir

    def check_adb_installed(self):
        return self.adb.check_adb_installed()

    def install_adb(self):
        return self.adb.install_adb(self.os_detector.detect_os())

    def get_device_name(self, device_id):
        try:
            result = self.run_command.run_command(['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'], 'transfer', capture_output=True, emit_output=False)
            if result.stdout:
                output = result.stdout
                if isinstance(output, bytes):
                    return output.strip().decode('utf-8')
                return output.strip()
            return device_id
        except Exception:
            return device_id

    def copy_file(self, device_id, src_file, files_completed, total_files):
        try:
            dest_path = self.get_file_destination(src_file)
            filename = os.path.basename(src_file)
            dest_file = f"{dest_path}/{filename}"

            # Initialize or reset device progress tracking
            if device_id not in self.device_progress:
                self.device_progress[device_id] = {
                    'last_progress': 0,
                    'current_file': filename,
                    'files_completed': files_completed,
                    'total_files': total_files
                }

            # Create destination directory
            self.adb.create_device_directory(device_id, dest_path)

            def progress_callback(progress):
                device_state = self.device_progress[device_id]
                
                # Ensure progress is monotonically increasing per device
                if progress < device_state['last_progress']:
                    return
                    
                device_state['last_progress'] = progress
                device_state['current_file'] = filename
                
                # Calculate overall progress for this specific device
                overall_progress = min(int((files_completed * 100 + progress) / total_files), 100)
                
                socketio.emit('transfer_progress', {
                    'device_id': device_id,
                    'current_file': filename,
                    'file_progress': progress,
                    'overall_progress': overall_progress,
                    'current_file_number': files_completed + 1,
                    'total_files': total_files,
                    'status': 'transferring'
                }, namespace='/transfer')

            success = self.adb.push_file(device_id, src_file, dest_file, progress_callback)
            
            if not success:
                # Preserve the current progress state for failed device
                failed_progress = self.device_progress.get(device_id, {})
                socketio.emit('transfer_status', {
                    'device_id': device_id,
                    'status': 'failed',
                    'current_file': filename,
                    'progress': failed_progress.get('last_progress', 0)
                }, namespace='/transfer')
                
            return success

        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error during file transfer: {str(e)}'}, namespace='/transfer')
            return False

    def get_file_destination(self, filename):
        """Determine the destination path based on file extension"""
        ext = filename.lower().split('.')[-1]
        if ext in ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'sid']:
            return self.file_paths['imagery']
        elif ext in ['p12', 'pem', 'crt', 'key']:
            return self.file_paths['certs']
        elif ext == 'zip':
            return self.file_paths['zip']
        else:
            return self.file_paths['prefs']

    def monitor_devices(self):
        socketio.emit('terminal_output', {'data': 'Starting device monitoring...'}, namespace='/transfer')
        self.monitoring = True
        last_device_states = {}  # Track last known device states
        
        try:
            process = self.adb.start_device_monitoring()
            
            while self.monitoring:
                try:
                    line = process.stdout.readline()
                    if not line:
                        continue
                    
                    if isinstance(line, bytes):
                        line = line.decode('utf-8')
                    line = line.strip()
                    
                    if line and not line.startswith('List'):
                        device_id, new_state = self.adb.parse_device_line(line)
                        if device_id:
                            # Only process state change if it's different from last known state
                            if device_id not in last_device_states or last_device_states[device_id] != new_state:
                                last_device_states[device_id] = new_state
                                self.handle_device_update(device_id, new_state)
                    
                    eventlet.sleep(0.1)
                except Exception as line_error:
                    socketio.emit('terminal_output', {
                        'data': f'Error reading device update: {str(line_error)}'
                    }, namespace='/transfer')
                    eventlet.sleep(1)
        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error during device monitoring: {str(e)}'
            }, namespace='/transfer')
        finally:
            if process:
                process.kill()

    def handle_device_update(self, device_id, new_state):
        try:
            device_name = self.adb.get_device_name(device_id)
            device_display = f"{device_name} ({device_id})"

            if new_state == 'device':
                socketio.emit('terminal_output', {
                    'data': f'📱 Device connected: {device_display}'
                }, namespace='/transfer')
                
                # Initialize device state
                self.device_states[device_id] = {
                    'state': 'device',
                    'name': device_name,
                    'status': 'idle'
                }

                # If transfer is running and device had failed or is new, start transfer
                if self.is_transfer_running:
                    all_files = set(os.listdir(self.temp_dir))
                    transferred = self.transferred_files.get(device_id, set())
                    remaining_files = all_files - transferred
                    
                    if remaining_files:
                        # Clear any previous failed state for this device
                        if device_id in self.device_progress:
                            del self.device_progress[device_id]
                        if device_id in self.transferred_files:
                            del self.transferred_files[device_id]
                            
                        socketio.emit('transfer_status', {
                            'isRunning': True,
                            'device_id': device_id,
                            'status': 'preparing'
                        }, namespace='/transfer')
                        
                        # Start transfer in background thread
                        eventlet.spawn(self.start_transfer, device_id)

            elif new_state in ['offline', 'unauthorized']:
                socketio.emit('terminal_output', {
                    'data': f'📱 Device disconnected: {device_display}'
                }, namespace='/transfer')
                
                # Mark transfer as failed if device was transferring
                if device_id in self.device_states and self.device_states[device_id].get('status') == 'transferring':
                    socketio.emit('transfer_status', {
                        'device_id': device_id,
                        'status': 'failed',
                        'current_file': 'Device Disconnected',
                        'progress': self.device_progress.get(device_id, {}).get('last_progress', 0)
                    }, namespace='/transfer')

                # Remove device from tracking
                self.device_states.pop(device_id, None)
                self.transferred_files.pop(device_id, None)
                self.device_progress.pop(device_id, None)

            # Update connected devices list
            current_devices = [
                {
                    'id': did,
                    'name': data['name'],
                    'status': data['status']
                }
                for did, data in self.device_states.items()
                if data['state'] == 'device'
            ]
            
            socketio.emit('connected_devices', {
                'devices': current_devices,
                'isTransferRunning': self.is_transfer_running
            }, namespace='/transfer')

        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error handling device update: {str(e)}'
            }, namespace='/transfer')

    def start_transfer(self, device_id):
        try:
            if not self.is_transfer_running:
                self.is_transfer_running = True
                socketio.emit('transfer_status', {
                    'isRunning': True,
                    'device_id': None,
                    'status': 'preparing', 
                    'progress': 0,
                    'current_file': ''
                }, namespace='/transfer')
            
            if device_id not in self.transferred_files:
                self.transferred_files[device_id] = set()

            all_files = [f for f in os.listdir(self.temp_dir) if os.path.isfile(os.path.join(self.temp_dir, f))]
            files_to_transfer = [f for f in all_files if f not in self.transferred_files[device_id]]

            if not files_to_transfer:
                socketio.emit('terminal_output', {'data': f'No new files to transfer for device {device_id}'}, namespace='/transfer')
                return

            total_files = len(files_to_transfer)
            files_completed = 0
            
            # Check if device is still connected before proceeding
            if device_id not in self.device_states:
                socketio.emit('transfer_status', {
                    'device_id': device_id,
                    'status': 'failed',
                    'current_file': 'Device Disconnected',
                    'progress': self.device_progress.get(device_id, {}).get('last_progress', 0)
                }, namespace='/transfer')
                return

            self.device_states[device_id]['status'] = 'transferring'
            
            socketio.emit('terminal_output', {'data': f'Starting transfer of {total_files} file/s for device {device_id}...'}, namespace='/transfer')
            
            for filename in files_to_transfer:
                # Check if device is still connected before each file
                if not self.is_transfer_running or device_id not in self.device_states:
                    socketio.emit('transfer_status', {
                        'device_id': device_id,
                        'status': 'failed',
                        'current_file': 'Device Disconnected',
                        'progress': self.device_progress.get(device_id, {}).get('last_progress', 0)
                    }, namespace='/transfer')
                    return
                
                src_file = os.path.join(self.temp_dir, filename)
                success = self.copy_file(device_id, src_file, files_completed, total_files)
                
                if success:
                    self.transferred_files[device_id].add(filename)
                    files_completed += 1
                else:
                    # Only try to update device state if it still exists
                    if device_id in self.device_states:
                        self.device_states[device_id]['status'] = 'failed'
                    socketio.emit('transfer_status', {
                        'device_id': device_id,
                        'status': 'failed',
                        'current_file': filename
                    }, namespace='/transfer')
                    return
                    
            # Only emit completed if device is still connected and all files transferred
            if self.is_transfer_running and device_id in self.device_states and files_completed == total_files:
                self.device_states[device_id]['status'] = 'completed'
                socketio.emit('transfer_status', {
                    'device_id': device_id,
                    'status': 'completed',
                    'current_file': '',
                    'isRunning': True
                }, namespace='/transfer')
                
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error during transfer for device {device_id}: {str(e)}'}, namespace='/transfer')
            # Only try to update device state if it still exists
            if device_id in self.device_states:
                self.device_states[device_id]['status'] = 'failed'
            socketio.emit('transfer_status', {
                'device_id': device_id,
                'status': 'failed',
                'current_file': '',
                'isRunning': True
            }, namespace='/transfer')

    def stop_transfer(self):
        try:
            socketio.emit('terminal_output', {'data': 'Stopping active transfers...'}, namespace='/transfer')
            
            # Store current progress only for actively transferring devices
            final_device_states = {}
            for device_id, progress_data in self.device_progress.items():
                if (device_id in self.device_states and 
                    self.device_states[device_id]['state'] == 'device' and 
                    self.device_states[device_id]['status'] == 'transferring'):  # Only track actively transferring devices
                    final_device_states[device_id] = {
                        'current_file': progress_data.get('current_file', ''),
                        'progress': progress_data.get('last_progress', 0)
                    }
            
            # Kill active push processes first
            self.adb.kill_adb_push_processes()
            
            # Reset transfer-related state variables
            self.is_transfer_running = False
            self.transferred_files.clear()
            self.device_progress.clear()
            
            # Single terminal output for process termination
            socketio.emit('terminal_output', {'data': 'Terminated all push processes'}, namespace='/transfer')
            
            # Emit failed status only for devices that were actively transferring
            for device_id, state in final_device_states.items():
                if device_id in self.device_states:
                    # Update device state to failed only if it was transferring
                    self.device_states[device_id]['status'] = 'failed'
                    # Then emit single status update with progress
                    socketio.emit('transfer_status', {
                        'device_id': device_id,
                        'status': 'failed',
                        'current_file': state['current_file'],
                        'progress': state['progress']
                    }, namespace='/transfer')
            
            # Emit final transfer stopped status
            socketio.emit('transfer_status', {
                'isRunning': False,
                'status': 'stopped'
            }, namespace='/transfer')
            
            # Update connected devices list once with final states
            current_devices = [
                {
                    'id': did,
                    'name': data['name'],
                    'status': data['status']  # This will now preserve completed status for successful transfers
                }
                for did, data in self.device_states.items()
                if data['state'] == 'device'
            ]
            
            socketio.emit('connected_devices', {
                'devices': current_devices,
                'isTransferRunning': False
            }, namespace='/transfer')
            
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error stopping transfer: {e}'}, namespace='/transfer')
            socketio.emit('transfer_status', {
                'isRunning': False,
                'status': 'stopped'
            }, namespace='/transfer')

    def start_monitoring(self):
        try:
            if not self.monitoring:
                self.monitoring = True
                # Let socketio namespace handle the task creation
                socketio.emit('monitoring_started', namespace='/transfer')
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error starting monitoring: {e}'}, namespace='/transfer')

    def stop_monitoring(self):
        self.monitoring = False
        socketio.emit('monitoring_stopped', namespace='/transfer')

    def get_transfer_status(self):
        """Get current transfer status"""
        socketio.emit('transfer_status', {
            'isRunning': self.is_transfer_running
        }, namespace='/transfer')
        
        # Re-emit current progress for all devices if transfer is running
        if self.is_transfer_running:
            for device_id, progress in self.device_progress.items():
                if device_id in self.device_states:
                    socketio.emit('transfer_progress', {
                        'device_id': device_id,
                        'current_file': progress.get('current_file', ''),
                        'file_progress': progress.get('last_progress', 0),
                        'overall_progress': min(int((progress.get('files_completed', 0) * 100 + progress.get('last_progress', 0)) / progress.get('total_files', 1)), 100),
                        'current_file_number': progress.get('files_completed', 0) + 1,
                        'total_files': progress.get('total_files', 1),
                        'status': self.device_states[device_id].get('status', 'transferring')
                    }, namespace='/transfer')
