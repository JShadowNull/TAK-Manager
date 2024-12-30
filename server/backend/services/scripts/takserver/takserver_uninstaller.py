import os
import shutil
from backend.services.helpers.run_command import RunCommand

class TakServerUninstaller:
    def __init__(self):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self._status = {
            'status': 'idle',
            'progress': 0,
            'message': '',
            'error': None
        }

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir
    
    def get_upload_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        upload_dir = os.path.join(base_dir, 'uploads')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
        return upload_dir

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

    def update_status(self, progress=None, message=None, status=None, error=None):
        """Update the uninstallation status"""
        if progress is not None:
            self._status['progress'] = progress
        if message is not None:
            self._status['message'] = message
        if status is not None:
            self._status['status'] = status
        if error is not None:
            self._status['error'] = error

    def get_status(self):
        """Get the current uninstallation status"""
        return self._status

    def stop_and_remove_containers(self):
        """Stop and remove all TAK Server containers and volumes."""
        try:
            docker_compose_dir = self.get_docker_compose_dir()
            version = self.get_takserver_version()
            
            # Update progress (0-40%)
            self.update_status(
                progress=10,
                message="Stopping TAK Server containers...",
                status='in_progress'
            )
            
            self.run_command.emit_log_output(
                "→ Stopping and removing TAK Server containers and volumes...", 
                'takserver-uninstall'
            )
            
            # Run docker-compose down with all cleanup flags
            self.update_status(
                progress=20,
                message="Removing TAK Server containers...",
                status='in_progress'
            )
            
            self.run_command.run_command(
                ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                working_dir=docker_compose_dir,
                namespace='takserver-uninstall',
                capture_output=False
            )

            self.update_status(
                progress=40,
                message="TAK Server containers removed",
                status='in_progress'
            )

            return True

        except Exception as e:
            self.run_command.emit_log_output(
                f"× Error stopping TAK Server containers: {str(e)}", 
                'takserver-uninstall'
            )
            self.update_status(
                status='error',
                error=str(e)
            )
            return False

    def remove_installation_directory(self):
        """Remove the TAK Server installation directory and upload directory."""
        try:
            # Remove installation directory
            if os.path.exists(self.working_dir):
                try:
                    self.update_status(
                        progress=70,
                        message=f"Removing TAK Server installation directory: {self.working_dir}",
                        status='in_progress'
                    )
                    
                    self.run_command.emit_log_output(
                        f"→ Removing TAK Server installation directory: {self.working_dir}", 
                        'takserver-uninstall'
                    )
                    
                    # Force remove the directory using rm -rf
                    self.run_command.run_command(
                        ["rm", "-rf", self.working_dir],
                        namespace='takserver-uninstall',
                        capture_output=False
                    )
                    
                    # Verify directory is gone
                    if os.path.exists(self.working_dir):
                        raise Exception("Failed to remove installation directory")
                    
                    self.update_status(
                        progress=75,
                        message="Installation directory removed successfully",
                        status='in_progress'
                    )
                    
                    self.run_command.emit_log_output(
                        "✓ Installation directory removed successfully", 
                        'takserver-uninstall'
                    )
                except Exception as e:
                    if os.path.exists(self.working_dir):
                        raise e

            # Remove upload directory
            upload_dir = self.get_upload_directory()
            if os.path.exists(upload_dir):
                try:
                    self.update_status(
                        progress=77,
                        message=f"Removing upload directory: {upload_dir}",
                        status='in_progress'
                    )

                    self.run_command.emit_log_output(
                        f"→ Removing upload directory: {upload_dir}",
                        'takserver-uninstall'
                    )

                    # Force remove the directory using rm -rf
                    self.run_command.run_command(
                        ["rm", "-rf", upload_dir],
                        namespace='takserver-uninstall',
                        capture_output=False
                    )

                    # Verify directory is gone
                    if os.path.exists(upload_dir):
                        raise Exception("Failed to remove upload directory")

                    self.update_status(
                        progress=80,
                        message="Upload directory removed successfully",
                        status='in_progress'
                    )

                    self.run_command.emit_log_output(
                        "✓ Upload directory removed successfully",
                        'takserver-uninstall'
                    )
                except Exception as e:
                    if os.path.exists(upload_dir):
                        raise e

            return True
        except Exception as e:
            self.run_command.emit_log_output(
                f"❌ Error removing directories: {str(e)}", 
                'takserver-uninstall'
            )
            self.update_status(
                status='error',
                error=str(e)
            )
            return False

    def clean_docker_build_cache(self):
        """Clean Docker build cache and BuildKit resources."""
        try:
            # Update progress (40-70%)
            self.update_status(
                progress=45,
                message="Cleaning up Docker build cache...",
                status='in_progress'
            )
            
            # Clean up BuildKit resources
            self.run_command.emit_log_output(
                "→ Cleaning up BuildKit resources...", 
                'takserver-uninstall'
            )
            
            # Get and remove BuildKit containers
            self.update_status(
                progress=50,
                message="Removing BuildKit containers...",
                status='in_progress'
            )
            
            buildkit_containers = [container_id for container_id in self.run_command.run_command(
                ["docker", "ps", "-a", "--filter", "ancestor=moby/buildkit:buildx-stable-1", "--format", "{{.ID}}"],
                namespace='takserver-uninstall',
                capture_output=True
            ).stdout.strip().split('\n') if container_id]
            
            if buildkit_containers:
                self.run_command.run_command(
                    ["docker", "rm", "-f"] + buildkit_containers,
                    namespace='takserver-uninstall',
                    capture_output=False
                )
                self.run_command.emit_log_output(
                    "→ BuildKit containers cleaned up", 
                    'takserver-uninstall'
                )
            
            # Get and remove BuildKit volumes
            self.update_status(
                progress=60,
                message="Removing BuildKit volumes...",
                status='in_progress'
            )
            
            buildkit_volumes = [volume_id for volume_id in self.run_command.run_command(
                ["docker", "volume", "ls", "--filter", "name=buildkit", "--quiet"],
                namespace='takserver-uninstall',
                capture_output=True
            ).stdout.strip().split('\n') if volume_id]
            
            if buildkit_volumes:
                self.run_command.run_command(
                    ["docker", "volume", "rm", "-f"] + buildkit_volumes,
                    namespace='takserver-uninstall',
                    capture_output=False
                )
                self.run_command.emit_log_output(
                    "→ BuildKit volumes cleaned up", 
                    'takserver-uninstall'
                )
            
            # Remove BuildKit image
            self.update_status(
                progress=65,
                message="Removing BuildKit image...",
                status='in_progress'
            )
            
            self.run_command.emit_log_output(
                "→ Removing BuildKit image...", 
                'takserver-uninstall'
            )
            self.run_command.run_command(
                ["docker", "rmi", "-f", "moby/buildkit:buildx-stable-1"],
                namespace='takserver-uninstall',
                capture_output=False
            )

            self.update_status(
                progress=70,
                message="Docker build cache cleaned",
                status='in_progress'
            )

            return True
        except Exception as e:
            self.run_command.emit_log_output(
                f"× Error cleaning Docker build cache: {str(e)}", 
                'takserver-uninstall'
            )
            self.update_status(
                status='error',
                error=str(e)
            )
            return False

    def uninstall(self):
        """Main uninstallation method."""
        try:
            # Start uninstall operation with 0% progress
            self.update_status(
                progress=0,
                message="Starting TAK Server uninstallation...",
                status='in_progress'
            )

            self.run_command.emit_log_output(
                "→ Starting TAK Server uninstallation...", 
                'takserver-uninstall'
            )

            # Stop and remove containers and volumes (0-40%)
            self.update_status(
                progress=10,
                message="Stopping TAK Server containers...",
                status='in_progress'
            )
            if not self.stop_and_remove_containers():
                raise Exception("Failed to stop and remove containers")

            # Clean Docker build cache (40-70%)
            self.update_status(
                progress=45,
                message="Cleaning up Docker build cache...",
                status='in_progress'
            )
            if not self.clean_docker_build_cache():
                raise Exception("Failed to clean Docker build cache")

            # Remove installation directory (70-80%)
            self.update_status(
                progress=70,
                message="Removing installation directory...",
                status='in_progress'
            )
            if not self.remove_installation_directory():
                raise Exception("Failed to remove installation directory")

            # Final cleanup and verification (80-100%)
            self.update_status(
                progress=90,
                message="Performing final cleanup...",
                status='in_progress'
            )

            self.update_status(
                progress=100,
                message="TAK Server uninstallation completed successfully",
                status='complete'
            )

            self.run_command.emit_log_output(
                "✓ TAK Server uninstallation completed successfully", 
                'takserver-uninstall'
            )
            return True

        except Exception as e:
            error_message = f"Uninstallation failed: {str(e)}"
            
            self.update_status(
                status='error',
                message=error_message,
                error=str(e)
            )

            self.run_command.emit_log_output(
                f"× {error_message}", 
                'takserver-uninstall'
            )
            return False 