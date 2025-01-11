import os
from backend.services.helpers.run_command import RunCommand
from flask_sse import sse
import time
from pathlib import Path
from backend.services.scripts.transfer.adb_controller import ADBController

class RapidFileTransfer:
    def __init__(self):
        self.run_command = RunCommand()
        self.device_states = {}  # Single state tracking dictionary
        self.monitoring = False
        self.working_dir = self.get_default_working_directory()
        self.temp_dir = os.path.join(self.working_dir, '.temp', 'rapid_transfer')
        self.is_transfer_running = False
        self.transferred_files = {}  # Track transferred files per device
        self.device_progress = {}  # Add this to track progress per device
        self.channel = 'transfer'  # Define a consistent channel for SSE events
        
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

    def emit_transfer_update(self, status_type="status", device_id=None, **data):
        """Unified transfer status/progress emission using SSE"""
        base_status = {
            'timestamp': time.time(),
            'type': status_type,  # 'status', 'progress', or 'error'
            'isRunning': self.is_transfer_running,
        }
        
        if device_id:
            base_status['device_id'] = device_id
            
        status = {**base_status, **data}
        sse.publish(
            {
                'type': 'transfer_update',
                'data': status
            },
            type='transfer_update',
            channel=self.channel
        )

    def emit_device_update(self, event_type, device_data):
        """Unified device state emission using SSE"""
        update = {
            'timestamp': time.time(),
            'type': event_type,  # 'connection', 'state_change'
            'devices': device_data if isinstance(device_data, list) else [device_data]
        }
        sse.publish(
            {
                'type': 'device_update',
                'data': update
            },
            type='device_update',
            channel=self.channel
        )

    def emit_file_update(self, event_type, files_data):
        """Unified file system update emission using SSE"""
        update = {
            'timestamp': time.time(),
            'type': event_type,  # 'list', 'change'
            'files': files_data
        }
        sse.publish(
            {
                'type': 'file_update',
                'data': update
            },
            type='file_update',
            channel=self.channel
        )

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

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
                
                self.emit_transfer_update(
                    device_id=device_id,
                    status_type="progress",
                    current_file=filename,
                    file_progress=progress,
                    overall_progress=overall_progress,
                    files_completed=files_completed + 1,
                    total_files=total_files
                )

            success = self.adb.push_file(device_id, src_file, dest_file, progress_callback)
            
            if not success:
                # Preserve the current progress state for failed device
                failed_progress = self.device_progress.get(device_id, {})
                self.emit_transfer_update(
                    device_id=device_id,
                    status_type="error",
                    state="failed",
                    error=f"Failed to push file {filename}",
                    last_progress=failed_progress.get('last_progress', 0)
                )
                
            return success

        except Exception as e:
            self.emit_transfer_update(
                device_id=device_id,
                status_type="error",
                error=f"Error during file transfer: {str(e)}"
            )
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
        self.emit_transfer_update(
            status_type="status",
            state="starting",
            message="Starting device monitoring..."
        )
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
                    
                    time.sleep(0.1)
                except Exception as line_error:
                    self.emit_transfer_update(
                        status_type="error",
                        error=f"Error reading device update: {str(line_error)}"
                    )
                    time.sleep(1)
        except Exception as e:
            self.emit_transfer_update(
                status_type="error",
                error=f"Error during device monitoring: {str(e)}"
            )
        finally:
            if process:
                process.kill()

    def handle_device_update(self, device_id, new_state):
        try:
            device_name = self.adb.get_device_name(device_id)
            device_display = f"{device_name} ({device_id})"

            if new_state == 'device':
                self.emit_device_update('connection', {
                    'id': device_id,
                    'name': device_name,
                    'status': 'connected',
                    'message': f'📱 Device connected: {device_display}'
                })
                
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
                            
                        self.emit_transfer_update(
                            device_id=device_id,
                            status_type="status",
                            state="preparing"
                        )
                        
                        # Let the route handle thread creation
                        self.start_transfer(device_id)

            elif new_state in ['offline', 'unauthorized']:
                self.emit_device_update('connection', {
                    'id': device_id,
                    'name': device_name,
                    'status': 'disconnected',
                    'message': f'📱 Device disconnected: {device_display}'
                })
                
                # Mark transfer as failed if device was transferring
                if device_id in self.device_states and self.device_states[device_id].get('status') == 'transferring':
                    self.emit_transfer_update(
                        device_id=device_id,
                        status_type="error",
                        state="failed",
                        error="Device Disconnected",
                        last_progress=self.device_progress.get(device_id, {}).get('last_progress', 0)
                    )

                # Remove device from tracking
                self.device_states.pop(device_id, None)
                self.transferred_files.pop(device_id, None)
                self.device_progress.pop(device_id, None)

            # Update connected devices list
            self.emit_connected_devices()

        except Exception as e:
            self.emit_transfer_update(
                status_type="error",
                error=f"Error handling device update: {str(e)}"
            )

    def start_monitoring(self):
        """Signal that monitoring should start"""
        if not self.monitoring:
            self.monitoring = True
            self.emit_transfer_update(
                status_type="status",
                state="starting",
                message="Starting monitoring..."
            )

    def start_transfer_all_devices(self):
        """Prepare transfer for all connected devices"""
        # Set transfer running state first
        self.is_transfer_running = True
        
        # Get list of files to transfer
        files = [f for f in os.listdir(self.temp_dir) 
                if os.path.isfile(os.path.join(self.temp_dir, f))]
        
        if not files:
            self.emit_transfer_update(
                status_type="error",
                error="No files to transfer"
            )
            return None
        
        self.emit_transfer_update(
            status_type="status",
            state="starting",
            total_files=len(files)
        )
            
        # Return list of device IDs that need transfer
        return [
            device_id for device_id, data in self.device_states.items()
            if data['state'] == 'device'
        ]

    def start_transfer(self, device_id):
        try:
            if not self.is_transfer_running:
                self.is_transfer_running = True
                self.emit_transfer_update(
                    status_type="status",
                    state="preparing"
                )
            
            if device_id not in self.transferred_files:
                self.transferred_files[device_id] = set()

            all_files = [f for f in os.listdir(self.temp_dir) if os.path.isfile(os.path.join(self.temp_dir, f))]
            files_to_transfer = [f for f in all_files if f not in self.transferred_files[device_id]]

            if not files_to_transfer:
                self.emit_transfer_update(
                    device_id=device_id,
                    status_type="status",
                    state="completed",
                    message=f'No new files to transfer for device {device_id}'
                )
                return

            total_files = len(files_to_transfer)
            files_completed = 0
            
            # Check if device is still connected before proceeding
            if device_id not in self.device_states:
                self.emit_transfer_update(
                    device_id=device_id,
                    status_type="error",
                    state="failed",
                    error="Device Disconnected",
                    last_progress=self.device_progress.get(device_id, {}).get('last_progress', 0)
                )
                return

            self.device_states[device_id]['status'] = 'transferring'
            self.emit_device_update('state_change', {
                'id': device_id,
                'status': 'transferring',
                'message': f'Starting transfer of {total_files} file/s'
            })

            for filename in files_to_transfer:
                # Check if device is still connected before each file
                if not self.is_transfer_running or device_id not in self.device_states:
                    self.emit_transfer_update(
                        device_id=device_id,
                        status_type="error",
                        state="failed",
                        error="Device Disconnected",
                        last_progress=self.device_progress.get(device_id, {}).get('last_progress', 0)
                    )
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
                    self.emit_transfer_update(
                        device_id=device_id,
                        status_type="error",
                        state="failed",
                        error=f"Failed to transfer {filename}"
                    )
                    return
                    
            # Only emit completed if device is still connected and all files transferred
            if self.is_transfer_running and device_id in self.device_states and files_completed == total_files:
                self.device_states[device_id]['status'] = 'completed'
                self.emit_transfer_update(
                    device_id=device_id,
                    status_type="status",
                    state="completed",
                    files_transferred=files_completed
                )
                
        except Exception as e:
            self.emit_transfer_update(
                device_id=device_id,
                status_type="error",
                state="failed",
                error=str(e)
            )
            # Only try to update device state if it still exists
            if device_id in self.device_states:
                self.device_states[device_id]['status'] = 'failed'

    def stop_transfer(self):
        try:
            self.emit_transfer_update(
                status_type="status",
                state="stopping",
                message="Stopping active transfers..."
            )
            
            # Store current progress only for actively transferring devices
            final_device_states = {}
            for device_id, progress_data in self.device_progress.items():
                if (device_id in self.device_states and 
                    self.device_states[device_id]['state'] == 'device' and 
                    self.device_states[device_id]['status'] == 'transferring'):
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
            
            # Emit failed status only for devices that were actively transferring
            for device_id, state in final_device_states.items():
                if device_id in self.device_states:
                    # Update device state to failed only if it was transferring
                    self.device_states[device_id]['status'] = 'failed'
                    self.emit_transfer_update(
                        device_id=device_id,
                        status_type="error",
                        state="failed",
                        error="Transfer stopped",
                        last_file=state['current_file'],
                        last_progress=state['progress']
                    )
            
            # Emit final transfer stopped status
            self.emit_transfer_update(
                status_type="status",
                state="stopped"
            )
            
            # Update connected devices list
            self.emit_connected_devices()
            
        except Exception as e:
            self.emit_transfer_update(
                status_type="error",
                error=f"Error stopping transfer: {str(e)}"
            )

    def stop_monitoring(self):
        self.monitoring = False
        self.emit_transfer_update(
            status_type="status",
            state="stopping",
            message="Stopping monitoring..."
        )

    def get_transfer_status(self):
        """Get current transfer status"""
        self.emit_transfer_update(
            status_type="status",
            state="current",
            is_running=self.is_transfer_running
        )
        
        # Re-emit current progress for all devices if transfer is running
        if self.is_transfer_running:
            for device_id, progress in self.device_progress.items():
                if device_id in self.device_states:
                    self.emit_transfer_update(
                        device_id=device_id,
                        status_type="progress",
                        current_file=progress.get('current_file', ''),
                        file_progress=progress.get('last_progress', 0),
                        overall_progress=min(int((progress.get('files_completed', 0) * 100 + progress.get('last_progress', 0)) / progress.get('total_files', 1)), 100),
                        files_completed=progress.get('files_completed', 0) + 1,
                        total_files=progress.get('total_files', 1),
                        state=self.device_states[device_id].get('status', 'transferring')
                    )

    def emit_connected_devices(self):
        """Emit current device list to clients"""
        devices = [
            {
                'id': did,
                'name': data['name'],
                'status': data['status']
            }
            for did, data in self.device_states.items()
            if data['state'] == 'device'
        ]
        
        self.emit_device_update('list', devices)
