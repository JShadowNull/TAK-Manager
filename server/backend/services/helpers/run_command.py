# backend/services/run_command_helper.py

import subprocess
import asyncio
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass

@dataclass
class CommandResult:
    success: bool
    returncode: int
    stdout: str
    stderr: str

class RunCommand:
    async def run_command_async(
        self,
        command,
        event_type: str,
        emit_event: Optional[Callable[[Dict[str, Any]], None]] = None,
        working_dir: Optional[str] = None,
        shell: bool = False,
        ignore_errors: bool = False
    ) -> CommandResult:
        """Run a command and stream output exactly like a terminal."""
        try:
            # Create subprocess
            process = await asyncio.create_subprocess_exec(
                *command if isinstance(command, list) else command.split(),
                stdout=asyncio.subprocess.PIPE, 
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir
            )

            # Stream both stdout and stderr in realtime
            async def read_stream(stream, is_stderr):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    if emit_event:
                        await emit_event({
                            "type": "terminal",
                            "message": line.decode().rstrip(),
                            "isError": is_stderr and not ignore_errors
                        })
                return await stream.read()

            # Read both streams concurrently
            stdout_data, stderr_data = await asyncio.gather(
                read_stream(process.stdout, False),
                read_stream(process.stderr, True)
            )
            
            # Wait for process to complete
            await process.wait()

            return CommandResult(
                success=process.returncode == 0 or ignore_errors,
                returncode=process.returncode,
                stdout=stdout_data.decode() if stdout_data else "",
                stderr=stderr_data.decode() if stderr_data else ""
            )

        except Exception as e:
            if emit_event:
                await emit_event({
                    "type": "terminal",
                    "message": str(e),
                    "isError": not ignore_errors
                })
            return CommandResult(
                success=False,
                returncode=1,
                stdout="",
                stderr=str(e)
            )