import os
import shutil
from pathlib import Path
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio

class TakServerUninstaller:
    def __init__(self):
        self.run_command = RunCommand()
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()

    def get_default_working_directory(self):
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type == 'windows' or os_type == 'macos':
            documents_dir = os.path.join(home_dir, 'Documents')
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            working_dir = os.path.join(home_dir, 'takserver-docker')
        return working_dir

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        if os.path.exists(version_file_path):
            with open(version_file_path, "r") as version_file:
                return version_file.read().strip()
        return None

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return os.path.join(self.working_dir, f"takserver-docker-{version}")

    def stop_and_remove_containers(self):
        """Stop and remove all TAK Server containers and volumes."""
        try:
            docker_compose_dir = self.get_docker_compose_dir()
            version = self.get_takserver_version()
            
            # Emit stopping status
            socketio.emit('takserver_status', {
                'isInstalled': True,
                'isRunning': True,
                'dockerRunning': True,
                'version': version,
                'error': None,
                'isStarting': False,
                'isStopping': True,
                'isRestarting': False,
                'isUninstalling': True
            }, namespace='/takserver-status')
            
            self.run_command.emit_log_output(
                "→ Stopping and removing TAK Server containers and volumes...", 
                'takserver-uninstall'
            )
            
            # Run docker-compose down with volume removal
            result = self.run_command.run_command(
                ["docker-compose", "down", "-v", "--remove-orphans"],
                working_dir=docker_compose_dir,
                namespace='takserver-uninstall',
                capture_output=False
            )

            # Remove any remaining containers with tak in the name
            self.run_command.emit_log_output(
                "→ Checking for remaining TAK Server containers...", 
                'takserver-uninstall'
            )
            containers = self.run_command.run_command(
                ["docker", "ps", "-a", "-q", "--filter", "name=tak"],
                namespace='takserver-uninstall',
                capture_output=True
            )
            if containers.stdout.strip():
                self.run_command.emit_log_output(
                    "→ Removing remaining TAK Server containers...", 
                    'takserver-uninstall'
                )
                self.run_command.run_command(
                    ["docker", "rm", "-f"] + containers.stdout.strip().split('\n'),
                    namespace='takserver-uninstall',
                    capture_output=False
                )

            # Remove all volumes associated with TAK server
            self.run_command.emit_log_output(
                "→ Removing TAK Server volumes...", 
                'takserver-uninstall'
            )

            # Remove named volumes
            volume_patterns = [
                f"takserver-{version}_*",  # TAK server volumes
                "*tak-database*",          # Database volumes
                "*takserver*"              # Any other TAK-related volumes
            ]

            for pattern in volume_patterns:
                volumes = self.run_command.run_command(
                    ["docker", "volume", "ls", "-q", "-f", f"name={pattern}"],
                    namespace='takserver-uninstall',
                    capture_output=True
                )
                if volumes.stdout.strip():
                    self.run_command.emit_log_output(
                        f"→ Removing volumes matching pattern: {pattern}", 
                        'takserver-uninstall'
                    )
                    self.run_command.run_command(
                        ["docker", "volume", "rm", "-f"] + volumes.stdout.strip().split('\n'),
                        namespace='takserver-uninstall',
                        capture_output=False
                    )

            # Final prune of all unused volumes
            self.run_command.emit_log_output(
                "→ Pruning unused volumes...", 
                'takserver-uninstall'
            )
            self.run_command.run_command(
                ["docker", "volume", "prune", "-f"],
                namespace='takserver-uninstall',
                capture_output=False
            )

            # Emit stopped status
            socketio.emit('takserver_status', {
                'isInstalled': True,
                'isRunning': False,
                'dockerRunning': True,
                'version': version,
                'error': None,
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': True
            }, namespace='/takserver-status')

            return True

        except Exception as e:
            # Emit error status
            socketio.emit('takserver_status', {
                'isInstalled': True,
                'isRunning': True,
                'dockerRunning': True,
                'version': self.get_takserver_version(),
                'error': str(e),
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': True
            }, namespace='/takserver-status')

            self.run_command.emit_log_output(
                f"× Error stopping TAK Server containers: {str(e)}", 
                'takserver-uninstall'
            )
            return False

    def remove_installation_directory(self):
        """Remove the TAK Server installation directory."""
        try:
            if os.path.exists(self.working_dir):
                self.run_command.emit_log_output(
                    f"→ Removing TAK Server installation directory: {self.working_dir}", 
                    'takserver-uninstall'
                )
                shutil.rmtree(self.working_dir)
                self.run_command.emit_log_output(
                    "✓ Installation directory removed successfully", 
                    'takserver-uninstall'
                )
            return True
        except Exception as e:
            self.run_command.emit_log_output(
                f"× Error removing installation directory: {str(e)}", 
                'takserver-uninstall'
            )
            return False

    def clean_docker_build_cache(self):
        """Clean Docker build cache for TAK Server images."""
        try:
            self.run_command.emit_log_output(
                "→ Cleaning Docker build cache and images...", 
                'takserver-uninstall'
            )
            
            # Remove TAK Server images
            self.run_command.emit_log_output(
                "→ Removing TAK Server images...", 
                'takserver-uninstall'
            )
            images = self.run_command.run_command(
                ["docker", "images", "-q", "--filter", "reference=*tak*"],
                namespace='takserver-uninstall',
                capture_output=True
            )
            if images.stdout.strip():
                self.run_command.run_command(
                    ["docker", "rmi", "-f"] + images.stdout.strip().split('\n'),
                    namespace='takserver-uninstall',
                    capture_output=False
                )

            # Prune unused build cache
            self.run_command.emit_log_output(
                "→ Pruning Docker build cache...", 
                'takserver-uninstall'
            )
            self.run_command.run_command(
                ["docker", "builder", "prune", "-f"],
                namespace='takserver-uninstall',
                capture_output=False
            )

            # Prune all unused images
            self.run_command.emit_log_output(
                "→ Pruning unused images...", 
                'takserver-uninstall'
            )
            self.run_command.run_command(
                ["docker", "image", "prune", "-a", "-f"],
                namespace='takserver-uninstall',
                capture_output=False
            )

            return True
        except Exception as e:
            self.run_command.emit_log_output(
                f"× Error cleaning Docker build cache: {str(e)}", 
                'takserver-uninstall'
            )
            return False

    def uninstall(self):
        """Main uninstallation method."""
        try:
            # Emit initial uninstall status
            socketio.emit('takserver_status', {
                'isInstalled': True,
                'isRunning': True,
                'dockerRunning': True,
                'version': self.get_takserver_version(),
                'error': None,
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': True
            }, namespace='/takserver-status')

            self.run_command.emit_log_output(
                "→ Starting TAK Server uninstallation...", 
                'takserver-uninstall'
            )

            # Stop and remove containers and volumes
            if not self.stop_and_remove_containers():
                raise Exception("Failed to stop and remove containers")

            # Clean Docker build cache
            if not self.clean_docker_build_cache():
                raise Exception("Failed to clean Docker build cache")

            # Remove installation directory
            if not self.remove_installation_directory():
                raise Exception("Failed to remove installation directory")

            # Emit final success status
            socketio.emit('takserver_status', {
                'isInstalled': False,
                'isRunning': False,
                'dockerRunning': True,
                'version': None,
                'error': None,
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': False
            }, namespace='/takserver-status')

            self.run_command.emit_log_output(
                "✓ TAK Server uninstallation completed successfully", 
                'takserver-uninstall'
            )
            return True

        except Exception as e:
            # Emit error status
            socketio.emit('takserver_status', {
                'isInstalled': True,
                'isRunning': False,
                'dockerRunning': True,
                'version': self.get_takserver_version(),
                'error': str(e),
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': False
            }, namespace='/takserver-status')

            self.run_command.emit_log_output(
                f"× Uninstallation failed: {str(e)}", 
                'takserver-uninstall'
            )
            return False 