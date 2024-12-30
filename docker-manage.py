#!/usr/bin/env python3

import os
import sys
import subprocess
import time
from typing import Optional
from dataclasses import dataclass
import argparse
from pathlib import Path
import platform
import dotenv

# Do not auto-load any env file
# We'll handle this explicitly in the manager class

@dataclass
class Colors:
    """ANSI color codes for terminal output"""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class DockerManager:
    def __init__(self):
        self.os_type = platform.system().lower()
        self.compose_command = self._get_compose_command()

    def _get_compose_command(self) -> str:
        """Get the appropriate docker compose command based on OS and Docker version"""
        try:
            # Try docker compose (newer versions)
            result = subprocess.run(['docker', 'compose', 'version'], 
                                 capture_output=True, 
                                 text=True)
            if result.returncode == 0:
                return 'docker compose'
        except:
            pass
        
        # Fallback to docker-compose
        return 'docker-compose'

    def _print_colored(self, message: str, color: str):
        """Print colored message to terminal"""
        if self.os_type != 'windows':
            print(f"{color}{message}{Colors.END}")
        else:
            print(message)

    def _run_command(self, command: str, shell: bool = True) -> int:
        """Run a shell command and return the exit code"""
        try:
            return subprocess.run(command, shell=shell).returncode
        except Exception as e:
            self._print_colored(f"Error executing command: {e}", Colors.RED)
            return 1

    def check_docker(self) -> bool:
        """Check if Docker is running"""
        try:
            subprocess.run(
                ['docker', 'info'],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            ).check_returncode()
            return True
        except:
            self._print_colored(
                "Error: Docker is not running. Please start Docker first.",
                Colors.RED
            )
            return False

    def start_dev(self, detach: bool = False):
        """Start in development mode"""
        self._print_colored("Starting in DEVELOPMENT mode...", Colors.YELLOW)
        
        # Check for .env file
        if not os.path.exists('.env'):
            self._print_colored("Error: .env file not found. Please create one using .env.example as a template.", Colors.RED)
            return 1
            
        # Explicitly load only .env file
        dotenv.load_dotenv(dotenv_path='.env', override=True)
            
        os.environ['MODE'] = 'dev'
        os.environ['BUILD_TARGET'] = 'development'
        cmd = f"{self.compose_command} up --build"
        if detach:
            cmd += " -d"
        return self._run_command(cmd)

    def start_prod(self, detach: bool = False):
        """Start in production mode"""
        self._print_colored("Starting in PRODUCTION mode...", Colors.YELLOW)
        
        # Check for .env file
        if not os.path.exists('.env'):
            self._print_colored("Error: .env file not found. Please create one using .env.example as a template.", Colors.RED)
            return 1
            
        # Explicitly load only .env file
        dotenv.load_dotenv(dotenv_path='.env', override=True)
            
        os.environ['MODE'] = 'prod'
        os.environ['BUILD_TARGET'] = 'production'
        cmd = f"{self.compose_command} up --build"
        if detach:
            cmd += " -d"
        return self._run_command(cmd)

    def stop(self):
        """Stop all containers"""
        self._print_colored("Stopping containers...", Colors.YELLOW)
        return self._run_command(f"{self.compose_command} down")

    def restart(self):
        """Restart containers"""
        self.stop()
        time.sleep(2)  # Give containers time to stop
        if os.getenv('MODE') == 'prod':
            return self.start_prod(detach=True)
        return self.start_dev(detach=True)

    def logs(self, follow: bool = False):
        """Show container logs"""
        cmd = f"{self.compose_command} logs --tail=100"
        if follow:
            cmd += " -f"
        return self._run_command(cmd)

    def clean(self):
        """Remove all containers and volumes"""
        self._print_colored("Cleaning all containers and volumes...", Colors.YELLOW)
        self._run_command(f"{self.compose_command} down -v")
        self._run_command("docker system prune -f")
        self._print_colored("Clean completed", Colors.GREEN)

    def build(self):
        """Rebuild containers"""
        self._print_colored("Rebuilding containers...", Colors.YELLOW)
        result = self._run_command(f"{self.compose_command} build --no-cache")
        if result == 0:
            self._print_colored("Build completed successfully", Colors.GREEN)
        return result

    def status(self):
        """Show container status"""
        print("Container Status:")
        self._run_command(f"{self.compose_command} ps")
        print("\nContainer Resources:")
        self._run_command("docker stats --no-stream")

def main():
    parser = argparse.ArgumentParser(description='Docker Manager for Tak-Manager')
    parser.add_argument('command', choices=[
        'dev', 'prod', 'stop', 'restart', 'logs', 
        'clean', 'build', 'status'
    ], help='Command to execute')
    parser.add_argument('-d', '--detach', action='store_true', 
                       help='Run containers in detached mode')
    parser.add_argument('-f', '--follow', action='store_true', 
                       help='Follow log output')

    args = parser.parse_args()
    manager = DockerManager()

    if not manager.check_docker():
        sys.exit(1)

    commands = {
        'dev': lambda: manager.start_dev(args.detach),
        'prod': lambda: manager.start_prod(args.detach),
        'stop': manager.stop,
        'restart': manager.restart,
        'logs': lambda: manager.logs(args.follow),
        'clean': manager.clean,
        'build': manager.build,
        'status': manager.status
    }

    sys.exit(commands[args.command]())

if __name__ == '__main__':
    main() 