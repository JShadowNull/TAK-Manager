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
            if shell:
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE, 
                    stderr=asyncio.subprocess.PIPE,
                    cwd=working_dir
                )
            else:
                process = await asyncio.create_subprocess_exec(
                    *command if isinstance(command, list) else command.split(),
                    stdout=asyncio.subprocess.PIPE, 
                    stderr=asyncio.subprocess.PIPE,
                    cwd=working_dir
                )

            # Stream both stdout and stderr in realtime
            async def read_stream(stream, is_stderr):
                output_lines = []
                buffer = ""
                
                while True:
                    chunk = await stream.read(1024)
                    if not chunk:
                        break
                        
                    buffer += chunk.decode()
                    
                    # Process complete lines
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.rstrip('\r')
                        if line:  # Only process non-empty lines
                            # Replace tab characters with spaces for consistent display
                            line = line.replace('\t', '    ')
                            # Handle any remaining escape sequences
                            line = bytes(line, 'utf-8').decode('unicode_escape')
                            output_lines.append(line)
                            if emit_event:
                                await emit_event({
                                    "type": "terminal",
                                    "message": line,
                                    "isError": is_stderr and not ignore_errors,
                                    "timestamp": None  # Let the frontend handle timestamps if needed
                                })
                
                # Process any remaining content in buffer
                if buffer:
                    buffer = buffer.rstrip('\r\n')
                    if buffer:  # Only process non-empty remaining content
                        # Replace tab characters with spaces for consistent display
                        buffer = buffer.replace('\t', '    ')
                        # Handle any remaining escape sequences
                        buffer = bytes(buffer, 'utf-8').decode('unicode_escape')
                        output_lines.append(buffer)
                        if emit_event:
                            await emit_event({
                                "type": "terminal",
                                "message": buffer,
                                "isError": is_stderr and not ignore_errors,
                                "timestamp": None
                            })
                
                return '\n'.join(output_lines)

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
                stdout=stdout_data if stdout_data else "",
                stderr=stderr_data if stderr_data else ""
            )

        except Exception as e:
            if emit_event:
                await emit_event({
                    "type": "terminal",
                    "message": str(e),
                    "isError": not ignore_errors,
                    "timestamp": None
                })
            return CommandResult(
                success=False,
                returncode=1,
                stdout="",
                stderr=str(e)
            )