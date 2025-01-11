import os
import shutil
from backend.services.helpers.run_command import RunCommand
from flask_sse import sse
import time

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
        self.event_type = 'takserver-uninstall'

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
        
    def _get_path_version(self, version):
        """Convert version string for path use (with RELEASE in uppercase)."""
        if not version:
            return None
        parts = version.split('-')
        if len(parts) >= 3:
            return f"{parts[0]}-RELEASE-{parts[2]}"
        return version

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        path_version = self._get_path_version(version)
        return os.path.join(self.working_dir, f"takserver-docker-{path_version}")

    def update_status(self, progress=None, message=None, status=None, error=None):
        """Update the uninstallation status and emit SSE events for both progress and terminal output"""
        if progress is not None:
            self._status['progress'] = progress
        if message is not None:
            self._status['message'] = message
        if status is not None:
            self._status['status'] = status
        if error is not None:
            self._status['error'] = error

        # Emit progress update SSE event
        sse.publish(
            {
                'status': self._status['status'],
                'operation': 'uninstall',
                'message': self._status['message'],
                'progress': self._status['progress'],
                'error': self._status['error']
            },
            type=self.event_type
        )

        # Emit terminal output SSE event if there's a message
        if message is not None:
            self.emit_terminal_output(message, error is not None)

    def emit_terminal_output(self, message, is_error=False):
        """Helper method to emit terminal output"""
        # Add progress percentage to message if available
        if self._status['progress'] > 0:
            message = f"[{self._status['progress']}%] {message}"
            
        sse.publish(
            {
                'message': message,
                'isError': is_error,
                'timestamp': int(time.time() * 1000),  # milliseconds timestamp
                'progress': self._status['progress']  # Include progress in terminal output
            },
            type='takserver-terminal'
        )

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
            
            # Run docker-compose down with all cleanup flags
            self.update_status(
                progress=20,
                message="Removing TAK Server containers..."
            )
            
            result = self.run_command.run_command(
                ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                event_type=self.event_type,
                working_dir=docker_compose_dir,
                emit_output=True
            )

            if not result.success:
                raise Exception(result.error_message)

            self.update_status(
                progress=40,
                message="TAK Server containers removed successfully"
            )

            return True

        except Exception as e:
            self.update_status(
                status='error',
                message=str(e),
                error=str(e)
            )
            raise

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
            # Get and remove BuildKit containers
            self.update_status(
                progress=50,
                message="Removing BuildKit containers..."
            )
            
            buildkit_containers = [container_id for container_id in self.run_command.run_command(
                ["docker", "ps", "-aq", "--filter", "name=buildkit"],
                event_type=self.event_type,
                capture_output=True
            ).stdout.strip().split('\n') if container_id]
            
            if buildkit_containers:
                result = self.run_command.run_command(
                    ["docker", "rm", "-f"] + buildkit_containers,
                    event_type=self.event_type,
                    emit_output=True
                )
                if not result.success:
                    raise Exception(result.error_message)
            
            # Get and remove BuildKit volumes
            self.update_status(
                progress=60,
                message="Removing BuildKit volumes..."
            )
            
            buildkit_volumes = [volume_id for volume_id in self.run_command.run_command(
                ["docker", "volume", "ls", "-q", "--filter", "name=buildkit"],
                event_type=self.event_type,
                capture_output=True
            ).stdout.strip().split('\n') if volume_id]
            
            if buildkit_volumes:
                result = self.run_command.run_command(
                    ["docker", "volume", "rm", "-f"] + buildkit_volumes,
                    event_type=self.event_type,
                    emit_output=True
                )
                if not result.success:
                    raise Exception(result.error_message)
            
            # Remove BuildKit image
            self.update_status(
                progress=65,
                message="Removing BuildKit image..."
            )
            
            result = self.run_command.run_command(
                ["docker", "rmi", "-f", "moby/buildkit:buildx-stable-1"],
                event_type=self.event_type,
                emit_output=True
            )
            if not result.success:
                raise Exception(result.error_message)

            self.update_status(
                progress=70,
                message="Docker build cache cleaned successfully"
            )

            return True
        except Exception as e:
            self.update_status(
                status='error',
                message=str(e),
                error=str(e)
            )
            raise

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
                    
                    # Force remove the directory using rm -rf
                    result = self.run_command.run_command(
                        ["rm", "-rf", self.working_dir],
                        event_type=self.event_type,
                        emit_output=True
                    )
                    if not result.success:
                        raise Exception(result.error_message)
                    
                    # Verify directory is gone
                    if os.path.exists(self.working_dir):
                        raise Exception("Failed to remove installation directory")
                    
                    self.update_status(
                        progress=75,
                        message="Installation directory removed successfully"
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
                        message=f"Removing upload directory: {upload_dir}"
                    )

                    # Force remove the directory using rm -rf
                    result = self.run_command.run_command(
                        ["rm", "-rf", upload_dir],
                        event_type=self.event_type,
                        emit_output=True
                    )
                    if not result.success:
                        raise Exception(result.error_message)

                    # Verify directory is gone
                    if os.path.exists(upload_dir):
                        raise Exception("Failed to remove upload directory")

                    self.update_status(
                        progress=80,
                        message="Upload directory removed successfully"
                    )

                except Exception as e:
                    if os.path.exists(upload_dir):
                        raise e

            return True
        except Exception as e:
            self.update_status(
                status='error',
                message=str(e),
                error=str(e)
            )
            raise

    def uninstall(self):
        """Main uninstallation method."""
        try:
            # Start uninstall operation with 0% progress
            self.update_status(
                progress=0,
                message="Starting TAK Server uninstallation...",
                status='in_progress'
            )

            # Stop and remove containers and volumes (0-40%)
            self.stop_and_remove_containers()

            # Clean Docker build cache (40-70%)
            self.clean_docker_build_cache()

            # Remove installation directory (70-80%)
            self.remove_installation_directory()

            # Final cleanup and verification (80-100%)
            self.update_status(
                progress=90,
                message="Performing final cleanup..."
            )

            self.update_status(
                progress=100,
                message="TAK Server uninstallation completed successfully",
                status='complete'
            )

            return True

        except Exception as e:
            # Send error status via SSE
            self.update_status(
                status='error',
                message=str(e),
                error=str(e)
            )
            return False 