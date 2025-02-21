import os
from backend.services.helpers.run_command import RunCommand
import time
from typing import Dict, Any, Optional, Callable
import docker
from backend.services.helpers.directories import DirectoryHelper
import asyncio

class TakServerUninstaller:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.emit_event = emit_event
        self.docker_client = docker.from_env()

    async def update_status(self, status: str, progress: float, message: Optional[str] = None, error: Optional[str] = None) -> None:
        """Update installation status."""
        if self.emit_event:
            # Send terminal message
            await self.emit_event({
                "type": "terminal",
                "message": message,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })
            
            # Send progress update
            await self.emit_event({
                "type": "status",
                "status": status,
                "progress": progress,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })

    async def stop_and_remove_containers(self):
        """Stop and remove all TAK Server containers."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "🛑 Stopping TAK Server containers...",
                "isError": False
            })
        try:
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            
            result = await self.run_command.run_command_async(
                ["docker", "compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                'uninstall',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            if not result.success:
                raise Exception(result.stderr)
            return True

        except Exception as e:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error stopping containers: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error stopping containers: {str(e)}")

    async def clean_docker_build_cache(self):
        """Clean Docker build cache."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "🧹 Cleaning Docker build cache...",
                "isError": False
            })
        try:
            await self.run_command.run_command_async(
                ["docker", "system", "prune", "-f"],
                'uninstall',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            return True

        except Exception as e:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error cleaning Docker cache: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error cleaning Docker cache: {str(e)}")

    async def remove_installation_directory(self):
        """Remove TAK Server directories."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "🗑️ Removing TAK Server directories...",
                "isError": False
            })
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
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error removing directories: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error removing directories: {str(e)}")

    async def uninstall(self) -> bool:
        """Main uninstallation method."""
        try:
            weights = {'containers': 40, 'cache': 30, 'directories': 25, 'cleanup': 5}
            progress = 0
            increment_delay = 1.0  # Update every 100ms
            
            async def smooth_progress(target: int, duration: float):
                nonlocal progress
                steps = int(duration / increment_delay)
                increment = (target - progress) / steps
                for _ in range(steps):
                    await asyncio.sleep(increment_delay)
                    progress = min(progress + increment, 100)
                    await self.update_status("in_progress", round(progress, 2))

            # Stop and remove containers (0-40%)
            containers_task = asyncio.create_task(smooth_progress(40, 5.0))
            await self.stop_and_remove_containers()
            containers_task.cancel()
            progress = 40
            await self.update_status("in_progress", progress)

            # Clean Docker cache (40-70%)
            cache_task = asyncio.create_task(smooth_progress(70, 3.0))
            await self.clean_docker_build_cache()
            cache_task.cancel()
            progress = 70
            await self.update_status("in_progress", progress)

            # Remove directories (70-95%)
            dirs_task = asyncio.create_task(smooth_progress(95, 2.0))
            await self.remove_installation_directory()
            dirs_task.cancel()
            progress = 95
            await self.update_status("in_progress", progress)

            # Final cleanup (95-100%)
            cleanup_task = asyncio.create_task(smooth_progress(100, 1.0))
            await asyncio.sleep(1)  # Simulate final cleanup
            cleanup_task.cancel()
            await self.update_status("complete", 100)
            self.emit_event({
                "type": "terminal",
                "message": "🎉 Uninstallation complete",
                "isError": False
            })
            
            return True

        except Exception as e:
            await self.update_status("error", 100, str(e))
            return False 