# backend/services/run_command_helper.py

import subprocess
import fcntl
import os
from flask_sse import sse
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class CommandResult:
    success: bool
    returncode: int
    stdout: str
    stderr: str
    error_message: Optional[str] = None

class RunCommand:
    def __init__(self):
        self.active_processes: Dict[str, subprocess.Popen] = {}

    def run_command(self, command, event_type, working_dir=None, shell=False, capture_output=False, check=True, emit_output=True):
        """
        Run a system command and stream the output to the frontend for the specified event type.
        This method now supports both streaming output (original behavior) and capturing output.

        Args:
            command (list or str): The system command to run.
            event_type (str): The event type for SSE to emit logs.
            working_dir (str): Optional working directory where the command should be executed.
            shell (bool): Whether to run the command in a shell (default: False).
            capture_output (bool): Whether to capture the command output and return it (default: False).
            check (bool): Whether to raise an exception if the command fails (default: True).
            emit_output (bool): Whether to emit output to frontend via SSE (default: True).
        
        Returns:
            CommandResult: Object containing success status, return code, stdout, stderr, and error message.
        """
        try:
            # Log command details (useful for debugging)
            if working_dir and emit_output:
                self.emit_log_output(f"Running command in directory: {working_dir}", event_type)
            command_str = ' '.join(command) if isinstance(command, list) else command
            if emit_output:
                self.emit_log_output(f"Executing command: {command_str}", event_type)

            if capture_output:
                result = subprocess.run(
                    command,
                    cwd=working_dir,
                    shell=shell,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=check
                )

                # Emit captured output to frontend if enabled
                if emit_output:
                    self.emit_log_output(result.stdout.strip(), event_type)
                    if result.stderr:
                        self.emit_log_output(result.stderr.strip(), event_type)

                return CommandResult(
                    success=True,
                    returncode=result.returncode,
                    stdout=result.stdout,
                    stderr=result.stderr
                )
            else:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    cwd=working_dir,
                    shell=shell
                )

                # Store process for potential cancellation
                process_id = f"{event_type}_{id(process)}"
                self.active_processes[process_id] = process

                # Stream output to frontend if enabled
                for stdout_line in iter(process.stdout.readline, ""):
                    if emit_output:
                        self.emit_log_output(stdout_line.strip(), event_type)
                    time.sleep(0)  # Yield control to time to avoid blocking

                process.stdout.close()
                return_code = process.wait()

                # Remove process from active processes
                self.active_processes.pop(process_id, None)

                if return_code != 0:
                    if emit_output:
                        self.emit_log_output(f"Command failed with exit code {return_code}.", event_type)
                    if check:
                        raise subprocess.CalledProcessError(return_code, command)
                else:
                    if emit_output:
                        self.emit_log_output("Command executed successfully.", event_type)

                return CommandResult(
                    success=return_code == 0,
                    returncode=return_code,
                    stdout='',
                    stderr=''
                )

        except subprocess.CalledProcessError as e:
            if emit_output:
                self.emit_log_output(f"Command failed with error: {e}", event_type)
            return CommandResult(
                success=False,
                returncode=e.returncode,
                stdout='',
                stderr=str(e),
                error_message=f"Command failed with error: {e}"
            )
        except OSError as e:
            if emit_output:
                self.emit_log_output(f"OS error during command execution: {e}", event_type)
            return CommandResult(
                success=False,
                returncode=1,
                stdout='',
                stderr=str(e),
                error_message=f"OS error during command execution: {e}"
            )
        except Exception as e:
            if emit_output:
                self.emit_log_output(f"Error during command execution: {e}", event_type)
            return CommandResult(
                success=False,
                returncode=1,
                stdout='',
                stderr=str(e),
                error_message=f"Error during command execution: {e}"
            )

    def run_command_no_output(self, command, working_dir=None, shell=False, check=True):
        """
        Run a system command without streaming the output to the frontend.
        This method uses the same logic as run_command but skips emitting the output.

        Args:
            command (list or str): The system command to run.
            working_dir (str): Optional working directory where the command should be executed.
            shell (bool): Whether to run the command in a shell (default: False).
            check (bool): Whether to raise an exception if the command fails (default: True).

        Returns:
            bool: True if the command executed successfully, False otherwise.
        """
        try:
            # Log the execution of the command (without emitting output to frontend)
            if working_dir:
                print(f"Running command in directory: {working_dir}")
            command_str = ' '.join(command) if isinstance(command, list) else command
            print(f"Executing command: {command_str}")

            # Run the command with subprocess.run without emitting the output
            result = subprocess.run(
                command,
                cwd=working_dir,
                shell=shell,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=check
            )

            # Log success or failure based on return code
            if result.returncode != 0:
                print(f"Command failed with exit code {result.returncode}.")
                if check:
                    raise subprocess.CalledProcessError(result.returncode, command)
            else:
                print("Command executed successfully.")

            return result.returncode == 0  # Return True for success, False for failure

        except subprocess.CalledProcessError as e:
            print(f"Command failed with error: {e}")
            return False
        except OSError as e:
            print(f"OS error during command execution: {e}")
            return False
        except Exception as e:
            print(f"Error during command execution: {e}")
            return False

    def emit_log_output(self, output, event_type):
        """
        Emit log output to the frontend via SSE.

        Args:
            output (str): The output log message.
            event_type (str): The event type to emit the logs to.
        """
        sse.publish(
            {
                'message': output,
                'isError': False,
                'timestamp': int(time.time() * 1000)
            },
            type=event_type
        )