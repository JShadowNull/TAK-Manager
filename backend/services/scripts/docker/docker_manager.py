# backend/services/scripts/docker_manager.py

import subprocess
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.operation_status import OperationStatus


class DockerManager:
    def __init__(self):
        self.os_detector = OSDetector()
        self.os_type = self.os_detector.detect_os()
        self.status_helper = None  # Will be set when socketio is available

    def initialize_status_helper(self, socketio):
        """Initialize the status helper with socketio instance"""
        self.status_helper = OperationStatus(socketio=socketio, namespace='/docker-manager')

    def start_container(self, container_name):
        """Start a Docker container by its name."""
        try:
            if not self.status_helper:
                return {"error": "Status helper not initialized"}

            # Start operation with container details
            self.status_helper.start_operation(
                'start',
                f"Starting container {container_name}...",
                details={'container': container_name}
            )

            result = subprocess.run(["docker", "start", container_name], capture_output=True, text=True)
            if result.returncode == 0:
                success_msg = f"Container {container_name} started successfully."
                self.status_helper.complete_operation(
                    'start',
                    success_msg,
                    details={'container': container_name}
                )
                return {"status": success_msg}
            else:
                error = f"Error starting container {container_name}: {result.stderr}"
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
                return {"error": error}
        except FileNotFoundError:
            error = "Docker is not installed or not available in PATH."
            if self.status_helper:
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
            return {"error": error}
        except Exception as e:
            error = f"Unexpected error starting container: {str(e)}"
            if self.status_helper:
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
            return {"error": error}

    def stop_container(self, container_name):
        """Stop a Docker container by its name."""
        try:
            # Start operation with container details
            self.status_helper.start_operation(
                'stop',
                f"Stopping container {container_name}...",
                details={'container': container_name}
            )

            result = subprocess.run(["docker", "stop", container_name], capture_output=True, text=True)
            if result.returncode == 0:
                success_msg = f"Container {container_name} stopped successfully."
                self.status_helper.complete_operation(
                    'stop',
                    success_msg,
                    details={'container': container_name}
                )
                return {"status": success_msg}
            else:
                error = f"Error stopping container {container_name}: {result.stderr}"
                self.status_helper.fail_operation(
                    'stop',
                    error,
                    details={'container': container_name}
                )
                return {"error": error}
        except FileNotFoundError:
            error = "Docker is not installed or not available in PATH."
            self.status_helper.fail_operation(
                'stop',
                error,
                details={'container': container_name}
            )
            return {"error": error}

    def start_docker(self):
        """Start Docker based on the detected OS"""
        try:
            # Start operation with details
            self.status_helper.start_operation(
                'start',
                "Starting Docker...",
                details={'service': 'docker'}
            )

            if self.os_type == 'macos':
                result = self._start_docker_desktop_macos()
            elif self.os_type == 'windows':
                result = self._start_docker_desktop_windows()
            elif self.os_type == 'linux':
                result = self._start_docker_cli_linux()
            else:
                error = "Unsupported OS. Cannot start Docker."
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'service': 'docker'}
                )
                return {"error": error}

            if 'error' in result:
                self.status_helper.fail_operation(
                    'start',
                    result['error'],
                    details={'service': 'docker'}
                )
            else:
                self.status_helper.complete_operation(
                    'start',
                    result['status'],
                    details={'service': 'docker'}
                )
            return result
        except Exception as e:
            error = f"Unexpected error starting Docker: {str(e)}"
            self.status_helper.fail_operation(
                'start',
                error,
                details={'service': 'docker'}
            )
            return {"error": error}

    def stop_docker(self):
        """Stop Docker based on the detected OS"""
        try:
            # Start operation with details
            self.status_helper.start_operation(
                'stop',
                "Stopping Docker...",
                details={'service': 'docker'}
            )

            if self.os_type == 'macos':
                result = self._stop_docker_desktop_macos()
            elif self.os_type == 'windows':
                result = self._stop_docker_desktop_windows()
            elif self.os_type == 'linux':
                result = self._stop_docker_cli_linux()
            else:
                error = "Unsupported OS. Cannot stop Docker."
                self.status_helper.fail_operation(
                    'stop',
                    error,
                    details={'service': 'docker'}
                )
                return {"error": error}

            if 'error' in result:
                self.status_helper.fail_operation(
                    'stop',
                    result['error'],
                    details={'service': 'docker'}
                )
            else:
                self.status_helper.complete_operation(
                    'stop',
                    result['status'],
                    details={'service': 'docker'}
                )
            return result
        except Exception as e:
            error = f"Unexpected error stopping Docker: {str(e)}"
            self.status_helper.fail_operation(
                'stop',
                error,
                details={'service': 'docker'}
            )
            return {"error": error}

    def _start_docker_desktop_macos(self):
        try:
            self.status_helper.update_progress(
                'start',
                25,
                "Launching Docker Desktop application...",
                details={'service': 'docker'}
            )
            subprocess.run(["open", "-a", "Docker"], check=True)
            self.status_helper.update_progress(
                'start',
                75,
                "Docker Desktop application launched, waiting for engine...",
                details={'service': 'docker'}
            )
            return {"status": "Starting Docker Desktop on macOS..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker Desktop: {e}"}

    def _start_docker_desktop_windows(self):
        try:
            self.status_helper.update_progress(
                'start',
                25,
                "Launching Docker Desktop application...",
                details={'service': 'docker'}
            )
            subprocess.run(["powershell", "Start-Process", "'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'"], check=True)
            self.status_helper.update_progress(
                'start',
                75,
                "Docker Desktop application launched, waiting for engine...",
                details={'service': 'docker'}
            )
            return {"status": "Starting Docker Desktop on Windows..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker Desktop: {e}"}

    def _start_docker_cli_linux(self):
        try:
            self.status_helper.update_progress(
                'start',
                25,
                "Starting Docker daemon...",
                details={'service': 'docker'}
            )
            subprocess.run(["sudo", "systemctl", "start", "docker"], check=True)
            self.status_helper.update_progress(
                'start',
                75,
                "Docker daemon started, waiting for engine...",
                details={'service': 'docker'}
            )
            return {"status": "Starting Docker CLI on Linux..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker CLI: {e}"}

    def stop_all_containers(self):
        """Stops all running Docker containers."""
        try:
            self.status_helper.update_progress(
                'stop',
                25,
                "Stopping all running containers...",
                details={'service': 'docker'}
            )
            result = subprocess.run(["docker", "ps", "-q"], capture_output=True, text=True)
            container_ids = result.stdout.strip().split("\n")
            
            if container_ids and container_ids[0]:
                for container_id in container_ids:
                    subprocess.run(["docker", "stop", container_id], check=True)
                self.status_helper.update_progress(
                    'stop',
                    50,
                    "All containers stopped successfully",
                    details={'service': 'docker'}
                )
                return {"status": "All running containers have been stopped."}
            else:
                self.status_helper.update_progress(
                    'stop',
                    50,
                    "No running containers to stop",
                    details={'service': 'docker'}
                )
                return {"status": "No running containers to stop."}
        
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop containers: {e}"}

    def _stop_docker_desktop_macos(self):
        try:
            # Step 1: Stop all running Docker containers
            container_result = self.stop_all_containers()
            if 'error' in container_result:
                return container_result
            
            # Step 2: Quit Docker Desktop (Docker Engine)
            self.status_helper.update_progress(
                'stop',
                75,
                "Stopping Docker Desktop application...",
                details={'service': 'docker'}
            )
            subprocess.run(["osascript", "-e", 'quit app "Docker"'], check=True)
            
            # Step 3: Kill Docker Desktop processes if they are still running
            subprocess.run(["pkill", "-f", "Docker Desktop"], check=True)
            subprocess.run(["pkill", "-f", "Docker.app"], check=True)
            
            return {"status": "Stopping Docker Desktop and Docker Engine on macOS..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop Docker Desktop: {e}"}

    def _stop_docker_desktop_windows(self):
        try:
            # Step 1: Stop all running Docker containers
            container_result = self.stop_all_containers()
            if 'error' in container_result:
                return container_result
            
            # Step 2: Stop Docker Desktop
            self.status_helper.update_progress(
                'stop',
                75,
                "Stopping Docker Desktop application...",
                details={'service': 'docker'}
            )
            subprocess.run(["powershell", "Stop-Process", "-Name", "Docker Desktop"], check=True)
            
            return {"status": "Stopping Docker Desktop on Windows..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop Docker Desktop: {e}"}

    def _stop_docker_cli_linux(self):
        try:
            # Step 1: Stop all running Docker containers
            container_result = self.stop_all_containers()
            if 'error' in container_result:
                return container_result
            
            # Step 2: Stop Docker CLI (the Docker daemon)
            self.status_helper.update_progress(
                'stop',
                75,
                "Stopping Docker daemon...",
                details={'service': 'docker'}
            )
            subprocess.run(["sudo", "systemctl", "stop", "docker"], check=True)
            
            return {"status": "Stopping Docker CLI on Linux..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop Docker CLI: {e}"}

    def list_containers(self):
        """List Docker containers (running and non-running) with their status."""
        try:
            result = subprocess.run(["docker", "ps", "-a", "--format", "{{.Names}}:{{.Status}}"], capture_output=True, text=True)
            if result.returncode == 0:
                containers = result.stdout.splitlines()
                container_list = []
                for container in containers:
                    name, status = container.split(":", 1)
                    container_list.append({"name": name, "status": status})
                return container_list
            else:
                print(f"Error: {result.stderr}")
                return []
        except FileNotFoundError:
            print("Docker is not installed or not available in PATH.")
            return []

