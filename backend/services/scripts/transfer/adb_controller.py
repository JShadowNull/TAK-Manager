import os
import subprocess
import re
import pexpect
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio

class ADBController:
    def __init__(self):
        self.run_command = RunCommand()
        self.active_push_processes = {}  # Dictionary to track active push processes by device_id

    def check_adb_installed(self):
        """Check if ADB is installed on the system"""
        try:
            socketio.emit('terminal_output', {'data': 'Checking if ADB is installed...'}, namespace='/transfer')
            result = self.run_command.run_command(['adb', 'version'], 'transfer', capture_output=True, check=False)
            return result.returncode == 0
        except Exception as e:
            socketio.emit('terminal_output', {'data': f'Error checking ADB installation: {e}'}, namespace='/transfer')
            return False

    def install_adb(self, os_type):
        """Install ADB based on OS type"""
        try:
            socketio.emit('installation_started', namespace='/transfer')
            
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
        """Get device name using ADB"""
        try:
            result = self.run_command.run_command(
                ['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'],
                'transfer',
                capture_output=True,
                emit_output=False
            )
            if result.stdout:
                output = result.stdout
                if isinstance(output, bytes):
                    return output.strip().decode('utf-8')
                return output.strip()
            return device_id
        except Exception:
            return device_id

    def create_device_directory(self, device_id, directory):
        """Create directory on device"""
        subprocess.run(['adb', '-s', device_id, 'shell', f'mkdir -p {directory}'])

    def push_file(self, device_id, src_file, dest_file, callback=None):
        """Push file to device with progress monitoring"""
        cmd = f'adb -s {device_id} push "{src_file}" "{dest_file}"'
        child = pexpect.spawn(cmd)
        pattern = re.compile(r'\[.*?(\d+)%\]')
        last_progress = -1

        # Store the process
        if device_id not in self.active_push_processes:
            self.active_push_processes[device_id] = []
        self.active_push_processes[device_id].append(child)

        try:
            while True:
                try:
                    index = child.expect([r'\[.*%\]', pexpect.EOF], timeout=1)
                    
                    if index == 0:
                        line = child.after.decode('utf-8')
                        match = pattern.search(line)
                        if match and callback:
                            progress = int(match.group(1))
                            if progress != last_progress:
                                last_progress = progress
                                callback(progress)
                    else:
                        break
                except pexpect.TIMEOUT:
                    continue

            child.close()
            # Remove process from tracking once complete
            if device_id in self.active_push_processes and child in self.active_push_processes[device_id]:
                self.active_push_processes[device_id].remove(child)
            return child.exitstatus == 0
        except Exception:
            # Clean up tracking on error
            if device_id in self.active_push_processes and child in self.active_push_processes[device_id]:
                self.active_push_processes[device_id].remove(child)
            return False

    def start_device_monitoring(self):
        """Start ADB device monitoring"""
        return self.run_command.stream_output(
            ['adb', 'track-devices'],
            'transfer',
            capture_output=True,
            check=False,
            stream_output=True
        )

    def kill_adb_push_processes(self, device_id=None):
        """Kill ADB push processes for a specific device or all devices
        
        Args:
            device_id (str, optional): Device ID to kill processes for. If None, kills all processes.
        """
        try:
            if device_id:
                # Kill processes for specific device
                if device_id in self.active_push_processes:
                    for process in self.active_push_processes[device_id]:
                        try:
                            process.sendcontrol('c')  # Send Ctrl+C
                            process.terminate(force=True)
                        except:
                            pass  # Ignore errors in process termination
                    self.active_push_processes[device_id] = []
                    socketio.emit('terminal_output', 
                        {'data': f'Terminated push processes for device {device_id}'}, 
                        namespace='/transfer')
            else:
                # Kill all processes
                for dev_id, processes in self.active_push_processes.items():
                    for process in processes:
                        try:
                            process.sendcontrol('c')  # Send Ctrl+C
                            process.terminate(force=True)
                        except:
                            pass  # Ignore errors in process termination
                self.active_push_processes.clear()
                socketio.emit('terminal_output', 
                    {'data': 'Terminated all push processes'}, 
                    namespace='/transfer')
            
            return True, 'killed'
        except Exception as e:
            socketio.emit('terminal_output', 
                {'data': f'Error while attempting to kill ADB push processes: {str(e)}'}, 
                namespace='/transfer')
            return False, 'error'

    def parse_device_line(self, line):
        """Parse device line from ADB output"""
        parts = line.split('\t')
        if len(parts) != 2:
            return None, None

        full_id = parts[0].strip()
        match = re.search(r'(?:\d+)?([A-Z0-9]{10,})', full_id)
        if not match:
            return None, None

        device_id = match.group(1)
        state = parts[1].strip()
        return device_id, state 