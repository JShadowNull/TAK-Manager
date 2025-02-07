import os
import shutil
from backend.services.helpers.run_command import RunCommand
import time
from typing import Dict, Any, Optional, Callable
import docker
import asyncio

class TakServerUninstaller:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self.emit_event = emit_event
        self.docker_client = docker.from_env()

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None) -> None:
        """Update uninstallation status."""
        if self.emit_event:
            await self.emit_event({
                "type": "status",
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })

    def get_default_working_directory(self):
        """Get the working directory."""
        base_dir = '/home/tak-manager'
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir
    
    def get_upload_directory(self):
        """Get the upload directory."""
        base_dir = '/home/tak-manager'
        upload_dir = os.path.join(base_dir, 'uploads')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
        return upload_dir

    def get_takserver_version(self):
        """Get TAK Server version from version.txt."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        if os.path.exists(version_file_path):
            with open(version_file_path, "r") as version_file:
                return version_file.read().strip()
        return None
        
    def _get_path_version(self, version):
        """Convert version string for path use."""
        if not version:
            return None
        parts = version.split('-')
        if len(parts) >= 3:
            return f"{parts[0]}-RELEASE-{parts[2]}"
        return version

    def get_docker_compose_dir(self):
        """Get the docker compose directory."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        path_version = self._get_path_version(version)
        return os.path.join(self.working_dir, f"takserver-docker-{path_version}")

    async def stop_and_remove_containers(self):
        """Stop and remove all TAK Server containers."""
        try:
            docker_compose_dir = self.get_docker_compose_dir()
            
            result = await self.run_command.run_command_async(
                ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                'uninstall',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            if not result.success:
                raise Exception(result.stderr)
            return True

        except Exception as e:
            raise Exception(f"Error stopping containers: {str(e)}")

    async def clean_docker_build_cache(self):
        """Clean Docker build cache."""
        try:
            # Clean BuildKit containers
            result = await self.run_command.run_command_async(
                ["docker", "ps", "-aq", "--filter", "name=buildkit"],
                'uninstall',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            if result.stdout.strip():
                containers = result.stdout.strip().split('\n')
                await self.run_command.run_command_async(
                    ["docker", "rm", "-f"] + containers,
                    'uninstall',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )

            # Clean BuildKit volumes
            result = await self.run_command.run_command_async(
                ["docker", "volume", "ls", "-q", "--filter", "name=buildkit"],
                'uninstall',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            if result.stdout.strip():
                volumes = result.stdout.strip().split('\n')
                await self.run_command.run_command_async(
                    ["docker", "volume", "rm", "-f"] + volumes,
                    'uninstall',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )

            # Remove BuildKit image
            await self.run_command.run_command_async(
                ["docker", "rmi", "-f", "moby/buildkit:buildx-stable-1"],
                'uninstall',
                emit_event=self.emit_event,
                ignore_errors=True
            )

            return True

        except Exception as e:
            raise Exception(f"Error cleaning Docker cache: {str(e)}")

    async def remove_installation_directory(self):
        """Remove TAK Server directories."""
        try:
            if os.path.exists(self.working_dir):
                result = await self.run_command.run_command_async(
                    ["rm", "-rf", self.working_dir],
                    'uninstall',
                    emit_event=self.emit_event
                )
                if not result.success or os.path.exists(self.working_dir):
                    raise Exception("Failed to remove installation directory")

            upload_dir = self.get_upload_directory()
            if os.path.exists(upload_dir):
                result = await self.run_command.run_command_async(
                    ["rm", "-rf", upload_dir],
                    'uninstall',
                    emit_event=self.emit_event
                )
                if not result.success or os.path.exists(upload_dir):
                    raise Exception("Failed to remove upload directory")

            return True

        except Exception as e:
            raise Exception(f"Error removing directories: {str(e)}")

    async def uninstall(self) -> bool:
        """Main uninstallation method."""
        try:
            # Define task weights and initial progress
            weights = {
                'containers': 40,  # Stop and remove containers
                'cache': 30,      # Clean Docker cache
                'directories': 25, # Remove directories
                'cleanup': 5      # Final cleanup
            }
            progress = 0
            
            # Initial status (0%)
            await self.update_status("in_progress", progress, "Starting TAK Server uninstallation...")

            # Stop and remove containers (0-40%)
            progress += weights['containers'] * 0.3
            await self.update_status("in_progress", progress, "Stopping TAK Server containers...")
            await self.stop_and_remove_containers()
            progress += weights['containers'] * 0.7
            await self.update_status("in_progress", progress, "Containers removed")

            # Clean Docker cache (40-70%)
            progress += weights['cache'] * 0.3
            await self.update_status("in_progress", progress, "Cleaning Docker build cache...")
            await self.clean_docker_build_cache()
            progress += weights['cache'] * 0.7
            await self.update_status("in_progress", progress, "Docker cache cleaned")

            # Remove directories (70-95%)
            progress += weights['directories'] * 0.3
            await self.update_status("in_progress", progress, "Removing TAK Server directories...")
            await self.remove_installation_directory()
            progress += weights['directories'] * 0.7
            await self.update_status("in_progress", progress, "Directories removed")

            # Final cleanup (95-100%)
            progress += weights['cleanup'] * 0.5
            await self.update_status("in_progress", progress, "Performing final cleanup...")
            progress += weights['cleanup'] * 0.5
            await self.update_status("complete", 100, "Uninstallation complete")
            return True

        except Exception as e:
            await self.update_status("error", 100, "Uninstallation failed", str(e))
            return False 