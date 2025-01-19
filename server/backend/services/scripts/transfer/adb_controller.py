import os
import subprocess
import re
import pexpect
from backend.services.helpers.run_command import RunCommand, CommandResult
from typing import Dict, Any, Optional, Callable, Tuple
import time
import asyncio
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

class ADBController:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.active_push_processes = {}  # Dictionary to track active push processes by device_id
        self.emit_event = emit_event
        self._last_status = None
        self.adb_server_port = 5037  # Default ADB server port

    async def _init_adb_server(self) -> bool:
        """Initialize ADB server with proper permissions in container"""
        try:
            # Kill any existing ADB server
            await self.run_command.run_command_async(
                ['adb', 'kill-server'],
                'adb_server',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            # Start ADB server with root permissions
            result = await self.run_command.run_command_async(
                ['adb', 'start-server'],
                'adb_server',
                emit_event=self.emit_event
            )
            
            if not result.success:
                logger.error(f"Failed to start ADB server: {result.stderr}")
                return False
                
            # Wait for server to be fully started
            await asyncio.sleep(1)
            
            # Verify server is running
            result = await self.run_command.run_command_async(
                ['adb', 'devices'],
                'adb_server',
                emit_event=self.emit_event
            )
            
            return result.success
            
        except Exception as e:
            logger.error(f"Error initializing ADB server: {str(e)}")
            return False

    async def _ensure_adb_server(self) -> bool:
        """Ensure ADB server is running and accessible"""
        try:
            result = await self.run_command.run_command_async(
                ['adb', 'get-state'],
                'adb_server',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if not result.success:
                logger.info("ADB server not responding, attempting to initialize...")
                return await self._init_adb_server()
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking ADB server: {str(e)}")
            return False

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None, device_id: Optional[str] = None) -> None:
        """Update ADB operation status."""
        if self.emit_event:
            new_status = {
                "type": "adb_status",
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            }
            
            if device_id:
                new_status["device_id"] = device_id
            
            # Only emit if status has changed
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status

    async def get_device_name(self, device_id: str) -> str:
        """Get device name using ADB"""
        try:
            if not await self._ensure_adb_server():
                return device_id
                
            result = await self.run_command.run_command_async(
                ['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'],
                'device_info',
                emit_event=self.emit_event
            )
            
            if result.success and result.stdout:
                return result.stdout.strip()
            
            logger.error(f"Failed to get device name: {result.stderr}")
            return device_id
            
        except Exception as e:
            logger.error(f"Error getting device name: {str(e)}")
            return device_id

    async def create_device_directory(self, device_id: str, directory: str) -> bool:
        """Create directory on device"""
        try:
            if not await self._ensure_adb_server():
                return False
                
            await self.update_status("creating_directory", 0, f"Creating directory {directory} on device {device_id}", device_id=device_id)
            
            result = await self.run_command.run_command_async(
                ['adb', '-s', device_id, 'shell', f'mkdir -p {directory}'],
                'device_directory',
                emit_event=self.emit_event
            )
            
            if not result.success:
                error_msg = f"Failed to create directory: {directory}"
                if result.stderr:
                    error_msg += f" - {result.stderr}"
                await self.update_status("error", 0, error_msg, error=error_msg, device_id=device_id)
                return False
                
            await self.update_status("directory_created", 100, f"Created directory {directory}", device_id=device_id)
            return True
            
        except Exception as e:
            error_msg = f"Error creating directory: {str(e)}"
            await self.update_status("error", 0, error_msg, error=error_msg, device_id=device_id)
            return False

    async def push_file(self, device_id: str, src_file: str, dest_file: str, callback: Optional[Callable[[int], None]] = None) -> bool:
        """Push file to device with progress monitoring"""
        try:
            if not await self._ensure_adb_server():
                return False
                
            await self.update_status("pushing_file", 0, f"Starting file transfer: {os.path.basename(src_file)}", device_id=device_id)
            
            # Create the adb push command
            cmd = f'adb -s {device_id} push "{src_file}" "{dest_file}"'
            child = pexpect.spawn(cmd)
            pattern = re.compile(r'\[.*?(\d+)%\]')
            last_progress = -1

            # Store the process
            if device_id not in self.active_push_processes:
                self.active_push_processes[device_id] = []
            self.active_push_processes[device_id].append(child)

            while True:
                try:
                    index = child.expect([r'\[.*%\]', pexpect.EOF], timeout=1)
                    
                    if index == 0:
                        line = child.after.decode('utf-8')
                        match = pattern.search(line)
                        if match:
                            progress = int(match.group(1))
                            if progress != last_progress:
                                last_progress = progress
                                if callback:
                                    callback(progress)
                                await self.update_status(
                                    "transferring", 
                                    progress,
                                    f"Transferring {os.path.basename(src_file)}: {progress}%",
                                    device_id=device_id
                                )
                    else:
                        break
                except pexpect.TIMEOUT:
                    continue

            child.close()
            # Remove process from tracking once complete
            if device_id in self.active_push_processes and child in self.active_push_processes[device_id]:
                self.active_push_processes[device_id].remove(child)
                
            if child.exitstatus == 0:
                await self.update_status(
                    "complete", 
                    100,
                    f"Successfully transferred {os.path.basename(src_file)}",
                    device_id=device_id
                )
                return True
            else:
                error_msg = f"Failed to transfer {os.path.basename(src_file)}"
                await self.update_status("error", 0, error_msg, error=error_msg, device_id=device_id)
                return False
                
        except Exception as e:
            error_msg = f"Error during file transfer: {str(e)}"
            await self.update_status("error", 0, error_msg, error=error_msg, device_id=device_id)
            return False

    async def start_device_monitoring(self) -> Optional[subprocess.Popen]:
        """Start ADB device monitoring"""
        try:
            await self.update_status("monitoring", 0, "Starting device monitoring")
            
            # Initialize ADB server
            if not await self._init_adb_server():
                error_msg = "Failed to initialize ADB server"
                await self.update_status("error", 0, error_msg, error=error_msg)
                return None
            
            # Start device monitoring
            process = subprocess.Popen(
                ['adb', 'track-devices'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            await self.update_status("monitoring", 100, "Device monitoring started")
            return process
            
        except Exception as e:
            error_msg = f"Error starting device monitoring: {str(e)}"
            await self.update_status("error", 0, error_msg, error=error_msg)
            return None

    async def kill_adb_push_processes(self, device_id: Optional[str] = None) -> Tuple[bool, str]:
        """Kill ADB push processes for a specific device or all devices"""
        try:
            if device_id:
                await self.update_status("terminating", 0, f"Terminating processes for device {device_id}", device_id=device_id)
            else:
                await self.update_status("terminating", 0, "Terminating all ADB processes")
                
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
                    await self.update_status(
                        "terminated", 
                        100,
                        f"Terminated push processes for device {device_id}",
                        device_id=device_id
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
                
                # Kill adb server to ensure clean state
                await self._init_adb_server()
                
                await self.update_status("terminated", 100, "Terminated all push processes")
            
            return True, 'killed'
            
        except Exception as e:
            error_msg = f"Error killing ADB push processes: {str(e)}"
            await self.update_status("error", 0, error_msg, error=error_msg)
            return False, 'error'

    def parse_device_line(self, line: str) -> Tuple[Optional[str], Optional[str]]:
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