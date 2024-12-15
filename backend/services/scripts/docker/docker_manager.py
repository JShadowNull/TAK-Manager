# backend/services/scripts/docker_manager.py

import subprocess
from backend.services.helpers.os_detector import OSDetector


class DockerManager:
    def __init__(self):
        self.os_detector = OSDetector()
        self.os_type = self.os_detector.detect_os()

    def start_docker(self):
        """Start Docker based on the detected OS"""
        if self.os_type == 'macos':
            return self._start_docker_desktop_macos()
        elif self.os_type == 'windows':
            return self._start_docker_desktop_windows()
        elif self.os_type == 'linux':
            return self._start_docker_cli_linux()
        else:
            return {"error": "Unsupported OS. Cannot start Docker."}

    def stop_docker(self):
        """Stop Docker based on the detected OS"""
        if self.os_type == 'macos':
            return self._stop_docker_desktop_macos()
        elif self.os_type == 'windows':
            return self._stop_docker_desktop_windows()
        elif self.os_type == 'linux':
            return self._stop_docker_cli_linux()
        else:
            return {"error": "Unsupported OS. Cannot stop Docker."}

    def list_containers(self):
        """List Docker containers (running and non-running) with their status."""
        try:
            result = subprocess.run(["docker", "ps", "-a", "--format", "{{.Names}}:{{.Status}}"], capture_output=True, text=True)
            if result.returncode == 0:
                containers = result.stdout.splitlines()  # List of container names and their statuses
                container_list = []
                for container in containers:
                    name, status = container.split(":", 1)  # Split name and status
                    container_list.append({"name": name, "status": status})
                return container_list
            else:
                print(f"Error: {result.stderr}")
                return []
        except FileNotFoundError:
            print("Docker is not installed or not available in PATH.")
            return []

    # Private methods for starting/stopping Docker based on OS
    def _start_docker_desktop_macos(self):
        try:
            subprocess.run(["open", "-a", "Docker"], check=True)
            return {"status": "Starting Docker Desktop on macOS..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker Desktop: {e}"}

    def _start_docker_desktop_windows(self):
        try:
            subprocess.run(["powershell", "Start-Process", "'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'"], check=True)
            return {"status": "Starting Docker Desktop on Windows..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker Desktop: {e}"}

    def _start_docker_cli_linux(self):
        try:
            subprocess.run(["sudo", "systemctl", "start", "docker"], check=True)
            return {"status": "Starting Docker CLI on Linux..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to start Docker CLI: {e}"}

    def stop_all_containers(self):
        """Stops all running Docker containers."""
        try:
            # Get a list of all running container IDs
            result = subprocess.run(["docker", "ps", "-q"], capture_output=True, text=True)
            container_ids = result.stdout.strip().split("\n")
            
            if container_ids and container_ids[0]:  # Check if there are any running containers
                for container_id in container_ids:
                    subprocess.run(["docker", "stop", container_id], check=True)
                return {"status": "All running containers have been stopped."}
            else:
                return {"status": "No running containers to stop."}
        
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop containers: {e}"}

    def _stop_docker_desktop_macos(self):
        try:
            # Step 1: Stop all running Docker containers
            self.stop_all_containers()
            
            # Step 2: Quit Docker Desktop (Docker Engine)
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
            self.stop_all_containers()
            
            # Step 2: Stop Docker Desktop
            subprocess.run(["powershell", "Stop-Process", "-Name", "Docker Desktop"], check=True)
            
            return {"status": "Stopping Docker Desktop on Windows..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop Docker Desktop: {e}"}

    def _stop_docker_cli_linux(self):
        try:
            # Step 1: Stop all running Docker containers
            self.stop_all_containers()
            
            # Step 2: Stop Docker CLI (the Docker daemon)
            subprocess.run(["sudo", "systemctl", "stop", "docker"], check=True)
            
            return {"status": "Stopping Docker CLI on Linux..."}
        except subprocess.CalledProcessError as e:
            return {"error": f"Failed to stop Docker CLI: {e}"}
        
    def start_container(self, container_name):
        """Start a Docker container by its name."""
        try:
            result = subprocess.run(["docker", "start", container_name], capture_output=True, text=True)
            if result.returncode == 0:
                return {"status": f"Container {container_name} started successfully."}
            else:
                return {"error": f"Error starting container {container_name}: {result.stderr}"}
        except FileNotFoundError:
            return {"error": "Docker is not installed or not available in PATH."}

    def stop_container(self, container_name):
        """Stop a Docker container by its name."""
        try:
            result = subprocess.run(["docker", "stop", container_name], capture_output=True, text=True)
            if result.returncode == 0:
                return {"status": f"Container {container_name} stopped successfully."}
            else:
                return {"error": f"Error stopping container {container_name}: {result.stderr}"}
        except FileNotFoundError:
            return {"error": "Docker is not installed or not available in PATH."}

