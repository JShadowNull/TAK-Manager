import subprocess
import platform
from backend.services.helpers.run_command import RunCommand
from backend.services.helpers.os_detector import OSDetector

class DockerChecker:
    def __init__(self):
        self.run_command = RunCommand()
        self.os_detector = OSDetector()

    def check_docker_installed(self):
        """Check if Docker is installed on the system."""
        try:
            result = self.run_command.run_command(
                ["docker", "--version"],
                namespace='docker-status',
                capture_output=False,
                emit_output=True
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.run_command.emit_log_output(
                "Docker is not installed", 
                'docker-status'
            )
            return False

    def check_docker_running(self):
        """Check if Docker daemon is running."""
        try:
            os_type = self.os_detector.detect_os()
            
            if os_type == 'macos':
                # For macOS, we need to check if the command succeeds and verify the output
                result = self.run_command.run_command(
                    ["docker", "info"],
                    namespace='docker-status',
                    capture_output=False,
                    emit_output=True
                )
                
                # If the command succeeds and doesn't contain error messages, Docker is running
                if result.returncode == 0 and 'Cannot connect to the Docker daemon' not in result.stderr:
                    return True
                return False
                
            elif os_type == 'linux':
                result = self.run_command.run_command(
                    ["systemctl", "is-active", "--quiet", "docker"],
                    namespace='docker-status',
                    capture_output=False,
                    emit_output=True
                )
                return result.returncode == 0
            else:
                self.run_command.emit_log_output(
                    "Unsupported operating system", 
                    'docker-status'
                )
                return False

        except subprocess.CalledProcessError as e:
            # Check for specific Docker daemon not running error
            if 'Cannot connect to the Docker daemon' in str(e.stderr):
                self.run_command.emit_log_output(
                    "Docker daemon is not running", 
                    'docker-status'
                )
            else:
                self.run_command.emit_log_output(
                    f"Error checking Docker status: {str(e)}", 
                    'docker-status'
                )
            return False
        except Exception as e:
            self.run_command.emit_log_output(
                f"Error checking Docker status: {str(e)}", 
                'docker-status'
            )
            return False

    def get_status(self):
        """Get complete Docker status."""
        is_installed = self.check_docker_installed()
        is_running = self.check_docker_running() if is_installed else False
        
        error = None
        if not is_installed:
            error = "Docker is not installed"
        elif not is_running:
            error = "Docker daemon is not running"

        status = {
            'isInstalled': is_installed,
            'isRunning': is_running,
            'error': error
        }

        return status 