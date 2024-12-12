import os
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
from backend.services.helpers.os_detector import OSDetector
import eventlet
from pathlib import Path
import shutil
import subprocess
import re
import traceback
import pexpect
import time


class RapidFileTransfer:
    def __init__(self):
        self.run_command = RunCommand()
        self.connected_devices = {}
        self.device_states = {}  # Add this to track device states
        self.last_device_update = {}  # Add this for debouncing
        self.debounce_time = 2  # 2 seconds debounce
        self.monitor_task = None
        self.monitoring = False
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()
        self.temp_dir = os.path.join(self.working_dir, '.temp', 'rapid_transfer')
        self.transferring = False
        self.file_paths = {
            'imagery': '/storage/emulated/0/atak/imagery',
            'certs': '/storage/emulated/0/atak/certs',
            'zip': '/storage/emulated/0/atak/tools/datapackage',
            'prefs': '/storage/emulated/0/atak/config/prefs'
        }

        # Ensure the temp directory exists
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)

        self.is_transfer_running = False
        self.transfer_tasks = {}  # Track transfer tasks by device_id
        self.transferred_files = {}  # Track transferred files per device

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
        try:
            socketio.emit('terminal_output', {'data': 'Checking if ADB is installed...'}, namespace='/transfer')
            result = self.run_command.run_command(['adb', 'version'], 'transfer', capture_output=True, check=False)
            return result.returncode == 0
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error checking ADB installation: {e}'}, namespace='/transfer')
            return False

    def install_adb(self):
        try:
            socketio.emit('installation_started', namespace='/transfer')
            os_type = self.os_detector.detect_os()
            
            if os_type == 'linux':
                result = self.run_command.run_command(['apt-get', 'install', 'adb', '-y'], 'transfer')
            elif os_type == 'macos':
                result = self.run_command.run_command(['brew', 'install', 'android-platform-tools'], 'transfer')
            elif os_type == 'windows':
                result = self.run_command.run_command(['choco', 'install', 'adb', '-y'], 'transfer')
            else:
                error_message = "Unsupported OS for ADB installation"
                socketio.emit('installation_failed', {'error': error_message}, namespace='/transfer')
                raise EnvironmentError(error_message)

            # Verify installation was successful
            verify_result = self.run_command.run_command(['adb', 'version'], 'transfer', check=False)
            
            if verify_result.returncode == 0:
                socketio.emit('installation_complete', {'status': 'success'}, namespace='/transfer')
            else:
                error_message = "ADB installation failed - unable to verify ADB installation"
                socketio.emit('installation_failed', {'error': error_message}, namespace='/transfer')
            
        except Exception as e:
            error_message = f'Error during ADB installation: {e}'
            socketio.emit('terminal_output', {'data': error_message}, namespace='/transfer')
            socketio.emit('installation_failed', {'error': error_message}, namespace='/transfer')

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

    def get_connected_devices(self):
        try:
            result = self.run_command.run_command(['adb', 'devices'], 'transfer', capture_output=True, check=False, emit_output=False)
            devices = []
            
            if result.stdout:
                output = result.stdout.decode('utf-8') if isinstance(result.stdout, bytes) else result.stdout
                lines = output.splitlines()
                
                for line in lines[1:]:  # Skip the first line
                    if '\tdevice' in line:
                        # Clean up device ID - remove any leading numbers/characters
                        full_id = line.split('\t')[0].strip()
                        # Extract the actual device ID using regex
                        match = re.search(r'(?:\d+)?([A-Z0-9]{10,})', full_id)
                        if match:
                            device_id = match.group(1)  # Use the actual device ID
                            if device_id not in self.device_states or self.device_states[device_id] == 'device':
                                devices.append({
                                    'id': device_id,
                                    'status': self.connected_devices.get(device_id, {}).get('status', 'idle')
                                })
            
            return devices
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error retrieving connected devices: {str(e)}'}, namespace='/transfer')
            return []

    def copy_file(self, device_id, src_file, files_completed, total_files):
        try:
            dest_path = self.get_file_destination(src_file)
            filename = os.path.basename(src_file)
            dest_file = f"{dest_path}/{filename}"

            # Create destination directory first
            subprocess.run(['adb', '-s', device_id, 'shell', f'mkdir -p {dest_path}'])

            # Construct adb push command
            cmd = f'adb -s {device_id} push "{src_file}" "{dest_file}"'
            
            # Start the process with pexpect
            child = pexpect.spawn(cmd)
            
            pattern = re.compile(r'\[.*?(\d+)%\]')
            last_progress = -1

            while True:
                try:
                    # Wait for either a progress update or EOF
                    index = child.expect([r'\[.*%\]', pexpect.EOF], timeout=1)
                    
                    if index == 0:  # Progress update
                        line = child.after.decode('utf-8')
                        # Clean up the line by removing control characters
                        clean_line = re.sub(r'\[K|\r', '', line)
                        
                        match = pattern.search(clean_line)
                        if match:
                            try:
                                progress = int(match.group(1))
                                
                                if progress != last_progress:
                                    last_progress = progress
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
                            except ValueError as ve:
                                socketio.emit('terminal_output', {
                                    'data': f'DEBUG - Error parsing progress: {str(ve)}'
                                }, namespace='/transfer')
                    else:  # EOF reached
                        break
                        
                except pexpect.TIMEOUT:
                    continue
                except Exception as e:
                    socketio.emit('terminal_output', {
                        'data': f'Error reading output: {str(e)}'
                    }, namespace='/transfer')
                    break

            # Get exit status
            child.close()
            exitcode = child.exitstatus

            if exitcode == 0:
                # Verify transfer
                verify_cmd = ['adb', '-s', device_id, 'shell', f'ls {dest_file}']
                verify_result = subprocess.run(verify_cmd, capture_output=True, text=True)
                
                if verify_result.returncode == 0 and verify_result.stdout.strip():
                    socketio.emit('transfer_progress', {
                        'device_id': device_id,
                        'current_file': filename,
                        'file_progress': 100,
                        'overall_progress': min(int(((files_completed + 1) * 100) / total_files), 100),
                        'current_file_number': files_completed + 1,
                        'total_files': total_files,
                        'status': 'completed'
                    }, namespace='/transfer')
                    return True

                raise Exception("File transfer verification failed")

            raise Exception(f"ADB push failed with exit code {exitcode}")

        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error during file transfer: {str(e)}'
            }, namespace='/transfer')
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
        try:
            process = self.run_command.stream_output(
                ['adb', 'track-devices'],
                'transfer',
                capture_output=True,
                check=False,
                stream_output=True
            )
            
            for line in process.stdout:
                if not self.monitoring:
                    break
                    
                if isinstance(line, bytes):
                    line = line.decode('utf-8')
                line = line.strip()
                
                if line and not line.startswith('List'):
                    self.handle_device_update(line)
                    
                eventlet.sleep(0.1)  # Small sleep to prevent CPU overuse
                
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error during device monitoring: {str(e)}'}, namespace='/transfer')

    def handle_device_update(self, line):
        try:
            parts = line.split('\t')
            if len(parts) != 2:
                return

            # Clean up device ID - remove any leading numbers/characters
            full_id = parts[0].strip()
            match = re.search(r'(?:\d+)?([A-Z0-9]{10,})', full_id)
            if not match:
                return  # Invalid device ID format
            
            device_id = match.group(1)  # Use the actual device ID
            new_state = parts[1].strip()
            current_time = time.time()

            # Remove debouncing for disconnect/reconnect scenarios
            if new_state != self.device_states.get(device_id):
                self.device_states[device_id] = new_state
                self.last_device_update[device_id] = current_time

                # Get device name for better identification
                device_name = self.get_device_name(device_id)
                device_display = f"{device_name} ({device_id})"

                if new_state == 'device':
                    socketio.emit('terminal_output', {
                        'data': f'📱 Device connected: {device_display}'
                    }, namespace='/transfer')
                    self.connected_devices[device_id] = {
                        'status': 'idle',
                        'progress': 0
                    }
                elif new_state in ['offline', 'unauthorized']:
                    socketio.emit('terminal_output', {
                        'data': f'📱 Device disconnected: {device_display}'
                    }, namespace='/transfer')
                    self.connected_devices.pop(device_id, None)
                    if device_id in self.transfer_tasks:
                        del self.transfer_tasks[device_id]
                    # Clear transferred files tracking when device disconnects
                    self.transferred_files.pop(device_id, None)

                # Update connected devices list
                current_devices = self.get_connected_devices()
                socketio.emit('connected_devices', {
                    'devices': current_devices,
                    'isTransferRunning': self.is_transfer_running
                }, namespace='/transfer')

                # Start transfer if there are new files to transfer
                if self.is_transfer_running and new_state == 'device':
                    all_files = set(os.listdir(self.temp_dir))
                    transferred = self.transferred_files.get(device_id, set())
                    if device_id not in self.transfer_tasks and (all_files - transferred):
                        socketio.emit('transfer_status', {
                            'isRunning': True,
                            'device_id': device_id,
                            'status': 'preparing'
                        }, namespace='/transfer')
                        self.start_transfer(device_id)

        except Exception as e:
            socketio.emit('terminal_output', {
                'data': f'Error handling device update: {str(e)}\n{traceback.format_exc()}'
            }, namespace='/transfer')

    def start_transfer(self, device_id):
        try:
            # Only set is_transfer_running to True if it's not already running
            if not self.is_transfer_running:
                self.is_transfer_running = True
                socketio.emit('transfer_status', {
                    'isRunning': True,
                    'device_id': None,
                    'status': 'preparing', 
                    'progress': 0,
                    'current_file': ''
                }, namespace='/transfer')
            
            # Initialize transferred files tracking for this device if not exists
            if device_id not in self.transferred_files:
                self.transferred_files[device_id] = set()

            # Get list of files that haven't been transferred to this device yet
            all_files = [f for f in os.listdir(self.temp_dir) if os.path.isfile(os.path.join(self.temp_dir, f))]
            files_to_transfer = [f for f in all_files if f not in self.transferred_files[device_id]]

            if not files_to_transfer:
                socketio.emit('terminal_output', {'data': f'No new files to transfer for device {device_id}'}, namespace='/transfer')
                return

            total_files = len(files_to_transfer)
            files_completed = 0
            
            self.connected_devices[device_id] = {
                'status': 'transferring',
                'progress': 0,
                'current_file': files_to_transfer[0]
            }
            
            socketio.emit('terminal_output', {'data': f'Starting transfer of {total_files} file/s for device {device_id}...'}, namespace='/transfer')
            
            for filename in files_to_transfer:
                if not self.is_transfer_running:
                    break
                
                src_file = os.path.join(self.temp_dir, filename)
                success = self.copy_file(device_id, src_file, files_completed, total_files)
                
                if success:
                    # Add to transferred files set only if transfer was successful
                    self.transferred_files[device_id].add(filename)
                    files_completed += 1
                else:
                    socketio.emit('transfer_status', {
                        'device_id': device_id,
                        'status': 'failed',
                        'current_file': filename
                    }, namespace='/transfer')
                    break
                    
            if self.is_transfer_running:
                # Emit device completion without affecting global transfer state
                socketio.emit('transfer_status', {
                    'device_id': device_id,
                    'status': 'completed',
                    'current_file': '',
                    'isRunning': True
                }, namespace='/transfer')
                
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error during transfer for device {device_id}: {str(e)}'}, namespace='/transfer')
            socketio.emit('transfer_status', {
                'device_id': device_id,
                'status': 'failed',
                'current_file': '',
                'isRunning': True
            }, namespace='/transfer')
        finally:
            self.transferring = False
            if device_id in self.transfer_tasks:
                del self.transfer_tasks[device_id]

    def stop_transfer(self):
        try:
            socketio.emit('terminal_output', {'data': 'Stopping transfer...'}, namespace='/transfer')
            
            # Reset all state variables
            self.transferring = False
            self.is_transfer_running = False
            self.transfer_tasks.clear()
            self.transferred_files.clear()
            self.monitoring = False
            
            # Kill any active adb processes
            try:
                if os.name == 'nt':  # Windows
                    subprocess.run(['taskkill', '/F', '/IM', 'adb.exe'], capture_output=True)
                else:  # Linux/Mac
                    subprocess.run(['pkill', '-f', 'adb'], capture_output=True)
                
                socketio.emit('terminal_output', {
                    'data': 'Successfully terminated all transfer processes'
                }, namespace='/transfer')
            except Exception as kill_error:
                socketio.emit('terminal_output', {
                    'data': f'Error killing transfer processes: {kill_error}'
                }, namespace='/transfer')

            # Reset device tracking
            self.device_states.clear()
            self.connected_devices.clear()
            
            # Clear the temp directory
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                os.makedirs(self.temp_dir)
            
            # Emit final status updates
            socketio.emit('transfer_status', {
                'isRunning': False,
                'status': 'stopped'
            }, namespace='/transfer')
            socketio.emit('connected_devices', {
                'devices': [],
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
