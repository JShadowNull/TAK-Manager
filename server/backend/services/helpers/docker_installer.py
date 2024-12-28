# backend/services/scripts/docker_installer.py

from backend.services.helpers.run_command import RunCommand
from backend.services.helpers.os_detector import OSDetector

class DockerInstaller:
    def __init__(self):
        self.os_detector = OSDetector()
        self.run_command = RunCommand()
        self.os_type = self.os_detector.detect_os()

    def is_docker_installed(self):
        """Check if Docker is already installed based on the detected OS"""
        try:
            if self.os_type == 'macos':
                result = self.run_command.run_command(["docker", "--version"], namespace='/docker-manager')
            elif self.os_type == 'windows':
                result = self.run_command.run_command(["powershell", "Get-Process", "-Name", "Docker Desktop"], namespace='/docker-manager')
            elif self.os_type == 'linux':
                result = self.run_command.run_command(["sudo", "systemctl", "is-active", "--quiet", "docker"], namespace='/docker-manager')
            else:
                return {"error": "Unsupported OS. Cannot check Docker installation."}

            # Check if result is a boolean
            if isinstance(result, bool):
                return {"installed": result}
            # If result is an object with returncode
            elif result and hasattr(result, 'returncode') and result.returncode == 0:
                return {"installed": True}
            else:
                return {"installed": False}
        except Exception as e:
            return {"error": f"Failed to check Docker installation: {e}"}

