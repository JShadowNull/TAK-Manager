import os
import shutil
from backend.services.helpers.run_command import RunCommand
import time
from typing import Dict, Any, Optional, Callable
import docker
import asyncio
from backend.services.helpers.directories import DirectoryHelper

class TakServerUninstaller:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
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

    async def stop_and_remove_containers(self):
        """Stop and remove all TAK Server containers."""
        try:
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            
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
            await self.run_command.run_command_async(
                ["docker", "system", "prune", "-f"],
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

            upload_dir = self.directory_helper.get_upload_directory()
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