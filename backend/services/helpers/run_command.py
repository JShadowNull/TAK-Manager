# backend/services/run_command_helper.py

import subprocess
import eventlet
from backend.routes.socketio import socketio
import fcntl
import os

class RunCommand:
    def run_command(self, command, namespace, working_dir=None, shell=False, capture_output=False, check=True, emit_output=True):
        """
        Run a system command and stream the output to the frontend for the specified namespace.
        This method now supports both streaming output (original behavior) and capturing output.

        Args:
            command (list or str): The system command to run.
            namespace (str): The namespace for Socket.IO to emit logs.
            working_dir (str): Optional working directory where the command should be executed.
            shell (bool): Whether to run the command in a shell (default: False).
            capture_output (bool): Whether to capture the command output and return it (default: False).
            check (bool): Whether to raise an exception if the command fails (default: True).
            emit_output (bool): Whether to emit output to frontend via Socket.IO (default: True).
        
        Returns:
            bool or subprocess.CompletedProcess: If capture_output is False, returns a boolean indicating success.
                                                If capture_output is True, returns a subprocess.CompletedProcess object.
        """
        try:
            # Log command details (useful for debugging)
            if working_dir and emit_output:
                self.emit_log_output(f"Running command in directory: {working_dir}", namespace)
            command_str = ' '.join(command) if isinstance(command, list) else command
            if emit_output:
                self.emit_log_output(f"Executing command: {command_str}", namespace)

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
                    self.emit_log_output(result.stdout.strip(), namespace)
                    if result.stderr:
                        self.emit_log_output(result.stderr.strip(), namespace)

                return result  # Return the subprocess.CompletedProcess object with captured output
            else:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    cwd=working_dir,
                    shell=shell
                )

                # Stream output to frontend if enabled
                for stdout_line in iter(process.stdout.readline, ""):
                    if emit_output:
                        self.emit_log_output(stdout_line.strip(), namespace)
                    eventlet.sleep(0)  # Yield control to eventlet to avoid blocking

                process.stdout.close()
                return_code = process.wait()

                if return_code != 0:
                    if emit_output:
                        self.emit_log_output(f"Command failed with exit code {return_code}.", namespace)
                    if check:
                        raise subprocess.CalledProcessError(return_code, command)
                else:
                    if emit_output:
                        self.emit_log_output("Command executed successfully.", namespace)

                return subprocess.CompletedProcess(command, return_code)  # Return a CompletedProcess object

        except subprocess.CalledProcessError as e:
            if emit_output:
                self.emit_log_output(f"Command failed with error: {e}", namespace)
            return subprocess.CompletedProcess(command, e.returncode, stdout='', stderr=str(e))
        except OSError as e:
            if emit_output:
                self.emit_log_output(f"OS error during command execution: {e}", namespace)
            return subprocess.CompletedProcess(command, 1, stdout='', stderr=str(e))
        except Exception as e:
            if emit_output:
                self.emit_log_output(f"Error during command execution: {e}", namespace)
            return subprocess.CompletedProcess(command, 1, stdout='', stderr=str(e))

    def run_command_no_output(self, command, working_dir=None, shell=False, check=True):
        """
        Run a system command without streaming the output to the frontend.
        This method uses the same logic as run_command but skips emitting the output to Socket.IO.

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
            # Handle and log specific subprocess.CalledProcessError
            print(f"Command failed with error: {e}")
            return False
        except OSError as e:
            # Handle and log specific OSError
            print(f"OS error during command execution: {e}")
            return False
        except Exception as e:
            # Handle and log other exceptions
            print(f"Error during command execution: {e}")
            return False

    def emit_log_output(self, output, namespace):
        """
        Emit log output to the frontend via Socket.IO.

        Args:
            output (str): The output log message.
            namespace (str): The namespace to emit the logs to.
        """
        # Emit log message via Socket.IO to the specified namespace
        socketio.emit('terminal_output', {'data': output}, namespace=f'/{namespace}')

    def stream_output(self, command, namespace, capture_output=True, check=True, stream_output=False):
        try:
            if stream_output:
                print(f"DEBUG: Starting stream_output with command: {command}")
                
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    bufsize=0,
                    universal_newlines=False,
                    text=False
                )
                
                print("DEBUG: Process created with Popen")
                
                # Set stdout to non-blocking mode
                fd = process.stdout.fileno()
                flags = fcntl.fcntl(fd, fcntl.F_GETFL)
                fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
                
                print("DEBUG: Set stdout to non-blocking mode")
                
                return process
            else:
                print(f"DEBUG: Running command without streaming: {command}")
                result = subprocess.run(
                    command,
                    capture_output=capture_output,
                    check=check,
                    text=True
                )
                return result
        except Exception as e:
            print(f"DEBUG: Error in stream_output: {str(e)}")
            print(f"DEBUG: Exception type: {type(e)}")
            import traceback
            print(f"DEBUG: Traceback: {traceback.format_exc()}")
            socketio.emit('terminal_output', 
                {'data': f'Error running command: {e}'}, 
                namespace=f'/{namespace}'
            )
            raise