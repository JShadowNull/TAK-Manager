import os
import subprocess
import re
import pexpect
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
import time

class ADBController:
    def __init__(self):
        self.run_command = RunCommand()
        self.active_push_processes = {}  # Dictionary to track active push processes by device_id

    def emit_adb_update(self, status_type="status", **data):
        """Unified ADB status emission"""
        update = {
            'timestamp': time.time(),
            'type': status_type,  # 'status', 'progress', or 'error'
            **data
        }
        socketio.emit('adb_update', update, namespace='/transfer')

    def check_adb_installed(self):
        """Check if ADB is installed on the system"""
        try:
            self.emit_adb_update(
                status_type="status",
                state="checking",
                message="Checking if ADB is installed..."
            )
            result = self.run_command.run_command(['adb', 'version'], 'transfer', capture_output=True, check=False)
            return result.returncode == 0
        except Exception as e:
            self.emit_adb_update(
                status_type="error",
                error=f"Error checking ADB installation: {str(e)}"
            )
            return False

    def install_adb(self, os_type):
        """Install ADB based on OS type"""
        try:
            self.emit_adb_update(
                status_type="status",
                state="installing",
                message="Starting ADB installation..."
            )
            
            if os_type == 'linux':
                result = self.run_command.run_command(['apt-get', 'install', 'adb', '-y'], 'transfer')
            elif os_type == 'macos':
                result = self.run_command.run_command(['brew', 'install', 'android-platform-tools'], 'transfer')
            elif os_type == 'windows':
                result = self.run_command.run_command(['choco', 'install', 'adb', '-y'], 'transfer')
            else:
                error_message = "Unsupported OS for ADB installation"
                self.emit_adb_update(
                    status_type="error",
                    error=error_message
                )
                raise EnvironmentError(error_message)

            # Verify installation was successful
            verify_result = self.run_command.run_command(['adb', 'version'], 'transfer', check=False)
            
            if verify_result.returncode == 0:
                self.emit_adb_update(
                    status_type="status",
                    state="completed",
                    message="ADB installation completed successfully"
                )
                return True
            else:
                error_message = "ADB installation failed - unable to verify ADB installation"
                self.emit_adb_update(
                    status_type="error",
                    error=error_message
                )
                return False
            
        except Exception as e:
            error_message = f'Error during ADB installation: {str(e)}'
            self.emit_adb_update(
                status_type="error",
                error=error_message
            )
            return False

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
        try:
            result = subprocess.run(['adb', '-s', device_id, 'shell', f'mkdir -p {directory}'])
            if result.returncode != 0:
                self.emit_adb_update(
                    status_type="error",
                    device_id=device_id,
                    error=f"Failed to create directory: {directory}"
                )
                return False
            return True
        except Exception as e:
            self.emit_adb_update(
                status_type="error",
                device_id=device_id,
                error=f"Error creating directory: {str(e)}"
            )
            return False

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
        except Exception as e:
            self.emit_adb_update(
                status_type="error",
                device_id=device_id,
                error=f"Error pushing file: {str(e)}"
            )
            # Clean up tracking on error
            if device_id in self.active_push_processes and child in self.active_push_processes[device_id]:
                self.active_push_processes[device_id].remove(child)
            return False

    def start_device_monitoring(self):
        """Start ADB device monitoring"""
        try:
            self.emit_adb_update(
                status_type="status",
                state="monitoring",
                message="Starting device monitoring"
            )
            return self.run_command.stream_output(
                ['adb', 'track-devices'],
                'transfer',
                capture_output=True,
                check=False,
                stream_output=True
            )
        except Exception as e:
            self.emit_adb_update(
                status_type="error",
                error=f"Error starting device monitoring: {str(e)}"
            )
            return None

    def kill_adb_push_processes(self, device_id=None):
        """Kill ADB push processes for a specific device or all devices"""
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
                    self.emit_adb_update(
                        status_type="status",
                        state="terminated",
                        device_id=device_id,
                        message=f"Terminated push processes for device {device_id}"
                    )
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
                self.emit_adb_update(
                    status_type="status",
                    state="terminated",
                    message="Terminated all push processes"
                )
            
            return True, 'killed'
        except Exception as e:
            self.emit_adb_update(
                status_type="error",
                error=f"Error killing ADB push processes: {str(e)}"
            )
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