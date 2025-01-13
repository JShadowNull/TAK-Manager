import os
import subprocess
import re
import pexpect
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, Optional, Callable
import time
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

class ADBController:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.active_push_processes = {}  # Dictionary to track active push processes by device_id
        self.emit_event = emit_event

    def _create_event(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an event object for SSE"""
        event_data = {
            'type': event_type,
            'data': {
                **data,
                'timestamp': time.time()
            }
        }
        logger.debug(f"Created event: {event_data}")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data

    def emit_adb_update(self, status_type="status", **data):
        """Unified ADB status emission using SSE"""
        update = {
            'type': status_type,  # 'status', 'progress', or 'error'
            **data
        }
        self._create_event('adb_update', update)

    def get_device_name(self, device_id):
        """Get device name using ADB"""
        try:
            result = self.run_command.run_command(
                ['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'],
                'device_info',
                capture_output=True,
                emit_output=False,
                emit_event=self.emit_event
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
            result = self.run_command.run_command(
                ['adb', '-s', device_id, 'shell', f'mkdir -p {directory}'],
                'device_directory',
                capture_output=True,
                emit_event=self.emit_event
            )
            if not result.success:
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
                                # Emit progress via SSE
                                self.emit_adb_update(
                                    status_type="progress",
                                    device_id=device_id,
                                    progress=progress,
                                    file=os.path.basename(src_file)
                                )
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
                'device_monitoring',
                capture_output=True,
                check=False,
                stream_output=True,
                emit_event=self.emit_event
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