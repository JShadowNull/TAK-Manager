import os
import json
import asyncio
import subprocess
from typing import AsyncGenerator, Dict, Any, List
from .check_status import TakServerStatus
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)


class LogManager:
    def __init__(self):
        self.tak_status = TakServerStatus()
        self._logs_dir = None

    @property
    def logs_dir(self) -> str:
        """Get the logs directory path based on current TAK Server version"""
        if not self._logs_dir:
            version = self.tak_status.get_takserver_version()
            if not version:
                raise Exception("TAK Server is not installed")
            
            base_dir = '/home/tak-manager/takserver-docker'
            self._logs_dir = os.path.join(base_dir, f"takserver-docker-{version}", "tak", "logs")
            
            if not os.path.exists(self._logs_dir):
                raise Exception("Logs directory not found")
                
        return self._logs_dir

    def get_available_logs(self) -> List[Dict[str, str]]:
        """Get list of available log files (only .log files, not .gz)"""
        try:
            log_files = []
            for filename in os.listdir(self.logs_dir):
                if filename.endswith('.log'):
                    file_path = os.path.join(self.logs_dir, filename)
                    log_files.append({
                        "id": filename,
                        "name": filename.replace('takserver-', '').replace('.log', ''),
                        "path": file_path,
                        "modified": os.path.getmtime(file_path)
                    })
            # Sort by modification time, newest first
            return sorted(log_files, key=lambda x: x['modified'], reverse=True)
        except Exception as e:
            logger.error(f"Error getting log files: {str(e)}")
            return []

    async def stream_log_file(self, log_file: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream a specific log file using tail -f"""
        try:
            log_path = os.path.join(self.logs_dir, log_file)
            
            if not os.path.exists(log_path):
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Log file not found"})
                }
                return

            # Get initial content (last 100 lines)
            process = await asyncio.create_subprocess_exec(
                'tail', '-n', '100', log_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if stderr:
                logger.error(f"Error reading log file: {stderr.decode()}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Error reading log file"})
                }
                return

            # Send initial content
            initial_lines = stdout.decode().splitlines()
            for line in initial_lines:
                if line.strip():
                    yield {
                        "event": "log",
                        "data": json.dumps({"message": line.strip()})
                    }

            # Start tail -f for real-time updates
            process = await asyncio.create_subprocess_exec(
                'tail', '-f', log_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                    
                line_str = line.decode().strip()
                if line_str:
                    yield {
                        "event": "log",
                        "data": json.dumps({"message": line_str})
                    }
                await asyncio.sleep(0.1)  # Small delay to prevent overwhelming the client

        except Exception as e:
            logger.error(f"Error streaming log file: {str(e)}")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            } 