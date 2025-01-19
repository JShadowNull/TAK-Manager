import os
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import json
import time
import asyncio
from pathlib import Path
from backend.services.scripts.transfer.adb_controller import ADBController
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

class RapidFileTransfer:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.device_states = {}  # Single state tracking dictionary
        self.monitoring = False
        self.working_dir = self.get_default_working_directory()
        self.temp_dir = os.path.join(self.working_dir, '.temp', 'rapid_transfer')
        self.is_transfer_running = False
        self.transferred_files = {}  # Track transferred files per device
        self.device_progress = {}  # Add this to track progress per device
        self.emit_event = emit_event
        self._last_status = None
        
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

        self.adb = ADBController(emit_event=self.emit_event)

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None, device_id: Optional[str] = None) -> None:
        """Update transfer status."""
        if self.emit_event:
            new_status = {
                "type": "transfer_status",
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "isError": error is not None,
                "isRunning": self.is_transfer_running,
                "timestamp": int(time.time() * 1000)
            }
            
            if device_id:
                new_status["device_id"] = device_id
                new_status["device_progress"] = self.device_progress.get(device_id, {})
            
            # Only emit if status has changed
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def get_device_name(self, device_id):
        return self.adb.get_device_name(device_id)

    async def copy_file(self, device_id, src_file, files_completed, total_files):
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
            success = await self.adb.create_device_directory(device_id, dest_path)
            if not success:
                return False

            def progress_callback(progress):
                device_state = self.device_progress[device_id]
                if progress < device_state['last_progress']:
                    return
                    
                device_state['last_progress'] = progress
                device_state['current_file'] = filename
                
                # Calculate overall progress for this specific device
                overall_progress = min(int((files_completed * 100 + progress) / total_files), 100)
                
                self.device_progress[device_id].update({
                    'file_progress': progress,
                    'overall_progress': overall_progress,
                    'current_file': filename,
                    'files_completed': files_completed + 1,
                    'total_files': total_files
                })

            success = await self.adb.push_file(device_id, src_file, dest_file, progress_callback)
            return success

        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error during file transfer: {str(e)}",
                error=str(e),
                device_id=device_id
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

    async def monitor_devices(self):
        """Monitor devices asynchronously."""
        await self.update_status("starting", 0, "Starting device monitoring...")
        self.monitoring = True
        last_device_states = {}
        
        try:
            process = await self.adb.start_device_monitoring()
            
            while self.monitoring and process:
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
                            if device_id not in last_device_states or last_device_states[device_id] != new_state:
                                last_device_states[device_id] = new_state
                                await self.handle_device_update(device_id, new_state)
                    
                    await asyncio.sleep(0.1)
                except Exception as line_error:
                    await self.update_status(
                        "error",
                        0,
                        f"Error reading device update: {str(line_error)}",
                        error=str(line_error)
                    )
                    await asyncio.sleep(1)
        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error during device monitoring: {str(e)}",
                error=str(e)
            )
        finally:
            if process:
                process.kill()

    async def handle_device_update(self, device_id, new_state):
        """Handle device state updates asynchronously."""
        try:
            device_name = self.get_device_name(device_id)
            device_display = f"{device_name} ({device_id})"

            if new_state == 'device':
                await self.update_status(
                    "device_connected",
                    100,
                    f"Device connected: {device_display}",
                    device_id=device_id
                )
                
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
                        if device_id in self.device_progress:
                            del self.device_progress[device_id]
                        if device_id in self.transferred_files:
                            del self.transferred_files[device_id]
                            
                        await self.update_status(
                            "preparing",
                            0,
                            f"Preparing transfer for device {device_display}",
                            device_id=device_id
                        )
                        
                        await self.start_transfer(device_id)

            elif new_state in ['offline', 'unauthorized']:
                await self.update_status(
                    "device_disconnected",
                    0,
                    f"Device disconnected: {device_display}",
                    device_id=device_id
                )
                
                # Mark transfer as failed if device was transferring
                if device_id in self.device_states and self.device_states[device_id].get('status') == 'transferring':
                    await self.update_status(
                        "failed",
                        self.device_progress.get(device_id, {}).get('last_progress', 0),
                        "Device Disconnected",
                        error="Device disconnected during transfer",
                        device_id=device_id
                    )

                # Remove device from tracking
                self.device_states.pop(device_id, None)
                self.transferred_files.pop(device_id, None)
                self.device_progress.pop(device_id, None)

            # Update connected devices list
            await self.emit_connected_devices()

        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error handling device update: {str(e)}",
                error=str(e),
                device_id=device_id
            )

    def start_monitoring(self):
        """Signal that monitoring should start"""
        if not self.monitoring:
            self.monitoring = True

    async def start_transfer_all_devices(self):
        """Prepare transfer for all connected devices"""
        try:
            # Set transfer running state first
            self.is_transfer_running = True
            
            # Get list of files to transfer
            files = [f for f in os.listdir(self.temp_dir) 
                    if os.path.isfile(os.path.join(self.temp_dir, f))]
            
            if not files:
                await self.update_status(
                    "error",
                    0,
                    "No files to transfer",
                    error="No files found in temp directory"
                )
                return None
            
            await self.update_status(
                "starting",
                0,
                f"Starting transfer of {len(files)} files"
            )
                
            # Return list of device IDs that need transfer
            return [
                device_id for device_id, data in self.device_states.items()
                if data['state'] == 'device'
            ]
        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error starting transfer: {str(e)}",
                error=str(e)
            )
            return None

    async def start_transfer(self, device_id):
        """Start transfer for a specific device asynchronously."""
        try:
            if not self.is_transfer_running:
                self.is_transfer_running = True
                await self.update_status(
                    "preparing",
                    0,
                    "Preparing transfer"
                )
            
            if device_id not in self.transferred_files:
                self.transferred_files[device_id] = set()

            all_files = [f for f in os.listdir(self.temp_dir) if os.path.isfile(os.path.join(self.temp_dir, f))]
            files_to_transfer = [f for f in all_files if f not in self.transferred_files[device_id]]

            if not files_to_transfer:
                await self.update_status(
                    "completed",
                    100,
                    f"No new files to transfer for device {device_id}",
                    device_id=device_id
                )
                return

            total_files = len(files_to_transfer)
            files_completed = 0
            
            # Check if device is still connected before proceeding
            if device_id not in self.device_states:
                await self.update_status(
                    "failed",
                    0,
                    "Device Disconnected",
                    error="Device disconnected before transfer started",
                    device_id=device_id
                )
                return

            self.device_states[device_id]['status'] = 'transferring'
            await self.update_status(
                "transferring",
                0,
                f"Starting transfer of {total_files} file/s",
                device_id=device_id
            )

            for filename in files_to_transfer:
                # Check if device is still connected before each file
                if not self.is_transfer_running or device_id not in self.device_states:
                    await self.update_status(
                        "failed",
                        self.device_progress.get(device_id, {}).get('last_progress', 0),
                        "Device Disconnected",
                        error="Device disconnected during transfer",
                        device_id=device_id
                    )
                    return
                
                src_file = os.path.join(self.temp_dir, filename)
                success = await self.copy_file(device_id, src_file, files_completed, total_files)
                
                if success:
                    self.transferred_files[device_id].add(filename)
                    files_completed += 1
                else:
                    # Only try to update device state if it still exists
                    if device_id in self.device_states:
                        self.device_states[device_id]['status'] = 'failed'
                    await self.update_status(
                        "failed",
                        self.device_progress.get(device_id, {}).get('last_progress', 0),
                        f"Failed to transfer {filename}",
                        error=f"Failed to transfer {filename}",
                        device_id=device_id
                    )
                    return
                    
            # Only emit completed if device is still connected and all files transferred
            if self.is_transfer_running and device_id in self.device_states and files_completed == total_files:
                self.device_states[device_id]['status'] = 'completed'
                await self.update_status(
                    "completed",
                    100,
                    f"Successfully transferred {files_completed} files",
                    device_id=device_id
                )
                
        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error during transfer: {str(e)}",
                error=str(e),
                device_id=device_id
            )
            # Only try to update device state if it still exists
            if device_id in self.device_states:
                self.device_states[device_id]['status'] = 'failed'

    async def stop_transfer(self):
        """Stop all active transfers."""
        try:
            await self.update_status(
                "stopping",
                0,
                "Stopping active transfers..."
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
            await self.adb.kill_adb_push_processes()
            
            # Reset transfer-related state variables
            self.is_transfer_running = False
            self.transferred_files.clear()
            self.device_progress.clear()
            
            # Emit failed status only for devices that were actively transferring
            for device_id, state in final_device_states.items():
                if device_id in self.device_states:
                    # Update device state to failed only if it was transferring
                    self.device_states[device_id]['status'] = 'failed'
                    await self.update_status(
                        "failed",
                        state['progress'],
                        "Transfer stopped",
                        error="Transfer was manually stopped",
                        device_id=device_id
                    )
            
            # Emit final transfer stopped status
            await self.update_status(
                "stopped",
                100,
                "All transfers stopped"
            )
            
            # Update connected devices list
            await self.emit_connected_devices()
            
        except Exception as e:
            await self.update_status(
                "error",
                0,
                f"Error stopping transfer: {str(e)}",
                error=str(e)
            )

    def stop_monitoring(self):
        """Stop device monitoring."""
        self.monitoring = False

    async def get_transfer_status(self):
        """Get current transfer status."""
        await self.update_status(
            "current",
            100 if not self.is_transfer_running else 0,
            "Current transfer status"
        )
        
        # Re-emit current progress for all devices if transfer is running
        if self.is_transfer_running:
            for device_id, progress in self.device_progress.items():
                if device_id in self.device_states:
                    await self.update_status(
                        self.device_states[device_id].get('status', 'transferring'),
                        progress.get('last_progress', 0),
                        f"Transferring {progress.get('current_file', '')}",
                        device_id=device_id
                    )

    async def emit_connected_devices(self):
        """Emit current device list to clients."""
        devices = [
            {
                'id': did,
                'name': data['name'],
                'status': data['status']
            }
            for did, data in self.device_states.items()
            if data['state'] == 'device'
        ]
        
        await self.update_status(
            "device_list",
            100,
            f"Connected devices: {len(devices)}",
            device_id=None,
            devices=devices
        )
