#!/usr/bin/env python3

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
SERVER_DIR = PROJECT_ROOT / "server"
ENV_EXAMPLE_FILE = PROJECT_ROOT / ".env.example"
ENV_FILE = PROJECT_ROOT / ".env"
BACKEND_PORT_DEFAULT = "8003"

# --- ANSI Colors ---
COLOR_RESET = "\033[0m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_BLUE = "\033[94m"
COLOR_BOLD = "\033[1m"

# --- Helper Functions ---
def print_status(message):
    """Prints a status message."""
    print(f"{COLOR_BLUE}ℹ {message}{COLOR_RESET}")

def print_success(message):
    """Prints a success message."""
    print(f"{COLOR_GREEN}✔ {message}{COLOR_RESET}")

def print_warning(message):
    """Prints a warning message."""
    print(f"{COLOR_YELLOW}⚠ WARNING: {message}{COLOR_RESET}")

def print_error(message):
    """Prints an error message and exits."""
    print(f"{COLOR_RED}✖ ERROR: {message}{COLOR_RESET}")
    sys.exit(1)

def get_documents_dir() -> Path:
    """Gets the user's Documents directory based on OS."""
    home = Path.home()
    system = platform.system()
    if system == "Windows":
        # Usually C:\Users\Username\Documents
        # Using a more reliable way via registry might be better, but this is common
        docs_path = home / "Documents"
        # Fallback for OneDrive users
        onedrive_docs = home / "OneDrive" / "Documents"
        if not docs_path.exists() and onedrive_docs.exists():
             return onedrive_docs
        return docs_path
    elif system == "Darwin":  # macOS
        return home / "Documents"
    else:  # Linux and other Unix-like
        # Using XDG standard if available
        xdg_docs = os.environ.get("XDG_DOCUMENTS_DIR")
        if xdg_docs and Path(xdg_docs).is_dir():
            return Path(xdg_docs)
        # Fallback to common location
        docs_path = home / "Documents"
        if not docs_path.exists():
             docs_path = home # Fallback further to home if Documents doesn't exist
        return docs_path


def command_exists(command):
    """Checks if a command exists in the system's PATH."""
    return shutil.which(command) is not None

def run_command(command_list, cwd=None, check=True, capture_output=False):
    """Runs a shell command."""
    print(f"  {COLOR_YELLOW}Running: {' '.join(command_list)}{COLOR_RESET}" + (f" in {cwd}" if cwd else ""))
    try:
        result = subprocess.run(
            command_list,
            cwd=cwd,
            check=check,
            capture_output=capture_output,
            text=True,
            stderr=subprocess.PIPE if not capture_output else None # Capture stderr for better error messages if check=True
        )
        if result.returncode != 0 and check:
             print_error(f"Command failed with error: {result.stderr}")
        return result
    except FileNotFoundError:
        print_error(f"Command not found: {command_list[0]}. Please ensure it's installed and in your PATH.")
    except subprocess.CalledProcessError as e:
        error_message = e.stderr if e.stderr else str(e)
        print_error(f"Command failed with error: {error_message}")
    except Exception as e:
        print_error(f"An unexpected error occurred while running the command: {e}")


def check_prerequisites():
    """Checks for necessary system dependencies."""
    print_status("Checking common prerequisites...")
    warnings = []

    # Docker
    if not command_exists("docker"):
        warnings.append(
            "Docker Engine not found. Please install it from: "
            f"{COLOR_YELLOW}https://docs.docker.com/engine/install/{COLOR_RESET}"
        )
    else:
        print_success("Docker found.")

    # Docker Compose (often included with Docker Desktop, check separately)
    # Use 'docker compose' (v2) instead of 'docker-compose' (v1)
    try:
        run_command(["docker", "compose", "version"], check=True, capture_output=True)
        print_success("Docker Compose found.")
    except Exception:
         warnings.append(
            "Docker Compose (v2) not found or not working. It's usually included with Docker Desktop. "
            f"See: {COLOR_YELLOW}https://docs.docker.com/compose/install/{COLOR_RESET}"
         )


    # OS-specific checks
    system = platform.system()
    print_status(f"Checking OS-specific prerequisites for {system}...")

    if system == "Darwin":  # macOS
        if not command_exists("create-dmg"):
            warnings.append(
                "`create-dmg` not found. Install via Homebrew: "
                f"{COLOR_YELLOW}brew install create-dmg{COLOR_RESET} "
                f"(See: {COLOR_YELLOW}https://github.com/create-dmg/create-dmg{COLOR_RESET})"
            )
        else:
            print_success("`create-dmg` found.")

    elif system == "Windows":
        # Inno Setup Compiler command-line is iscc.exe
        # We need to check if it's in PATH or common install locations
        iscc_path = shutil.which("iscc")
        if not iscc_path:
            # Check common Program Files locations
            program_files = os.environ.get("ProgramFiles(x86)") or os.environ.get("ProgramFiles")
            if program_files:
                possible_iscc = Path(program_files) / "Inno Setup 6" / "iscc.exe"
                if possible_iscc.exists():
                    iscc_path = str(possible_iscc) # Found it, but not in PATH

        if not iscc_path:
             warnings.append(
                "Inno Setup Compiler CLI (`iscc.exe`) not found in PATH or common locations. "
                "Please install Inno Setup and ensure `iscc.exe` is in your system PATH. "
                f"Download: {COLOR_YELLOW}https://jrsoftware.org/isinfo.php{COLOR_RESET}"
             )
        else:
            print_success("Inno Setup Compiler (`iscc`) found.")

    elif system == "Linux":
        print_status("No specific prerequisites to check for Linux distributions (beyond Docker/Compose).")
    else:
        print_warning(f"Unsupported OS ({system}) for specific prerequisite checks.")

    # Print all warnings at the end
    if warnings:
        print(f"{COLOR_BOLD}{COLOR_YELLOW}--- Prerequisite Warnings ---{COLOR_RESET}")
        for warning in warnings:
            print_warning(warning)
        print(f"{COLOR_BOLD}{COLOR_YELLOW}-----------------------------{COLOR_RESET}")
        input(f"{COLOR_YELLOW}Press Enter to continue setup despite warnings, or Ctrl+C to abort...{COLOR_RESET}")
    else:
        print_success("All prerequisites seem to be met.")


def setup_env_file():
    """Copies .env.example to .env and fills in required values."""
    if ENV_FILE.exists():
        print_warning(f"'{ENV_FILE.name}' already exists. Skipping creation.")
        # Optionally ask to overwrite or merge here
        return

    if not ENV_EXAMPLE_FILE.exists():
        print_error(f"'{ENV_EXAMPLE_FILE.name}' not found. Cannot create '.env' file.")

    print_status(f"Copying '{ENV_EXAMPLE_FILE.name}' to '{ENV_FILE.name}'...")
    try:
        shutil.copyfile(ENV_EXAMPLE_FILE, ENV_FILE)
    except Exception as e:
        print_error(f"Failed to copy .env.example: {e}")

    print_status("Configuring '.env' file...")
    try:
        content = ENV_FILE.read_text().splitlines()
        new_content = []
        docs_dir = get_documents_dir()
        tak_dir_str = str(docs_dir).replace("\\", "\\\\") # Escape backslashes for Windows paths in .env

        port_set = False
        tak_dir_set = False

        for line in content:
            if line.strip().startswith("BACKEND_PORT="):
                 new_content.append(f"BACKEND_PORT={BACKEND_PORT_DEFAULT}")
                 port_set = True
            elif line.strip().startswith("TAK_SERVER_INSTALL_DIR="):
                 new_content.append(f"TAK_SERVER_INSTALL_DIR={tak_dir_str}")
                 tak_dir_set = True
            else:
                 new_content.append(line)

        # Add if missing (though they should be in the example)
        if not port_set:
             new_content.append(f"BACKEND_PORT={BACKEND_PORT_DEFAULT}")
             print_warning("BACKEND_PORT was not found in .env.example, added.")
        if not tak_dir_set:
             new_content.append(f"TAK_SERVER_INSTALL_DIR={tak_dir_str}")
             print_warning("TAK_SERVER_INSTALL_DIR was not found in .env.example, added.")

        ENV_FILE.write_text("\n".join(new_content) + "\n") # Ensure trailing newline
        print_success(f"Set BACKEND_PORT to {BACKEND_PORT_DEFAULT}")
        print_success(f"Set TAK_SERVER_INSTALL_DIR to {docs_dir}")

    except Exception as e:
        print_error(f"Failed to read/write '.env' file: {e}")


def install_dependencies():
    """Installs npm and poetry dependencies."""

    # Check for package managers
    if not command_exists("npm"):
        print_error("`npm` command not found. Please install Node.js and npm: https://nodejs.org/")
    if not command_exists("poetry"):
         print_error("`poetry` command not found. Please install Poetry: https://python-poetry.org/docs/#installation")


    print_status("Installing root npm dependencies (workspaces)...")
    run_command(["npm", "install", "--workspaces"], cwd=PROJECT_ROOT)
    print_success("Root npm dependencies installed.")

    print_status("Installing root Python dependencies (poetry)...")
    run_command(["poetry", "install"], cwd=PROJECT_ROOT)
    print_success("Root Python dependencies installed.")

    print_status("Installing server Python dependencies (poetry)...")
    if not SERVER_DIR.exists() or not (SERVER_DIR / "pyproject.toml").exists():
         print_error(f"Server directory '{SERVER_DIR}' or its 'pyproject.toml' not found.")
    run_command(["poetry", "install"], cwd=SERVER_DIR)
    print_success("Server Python dependencies installed.")


def main():
    def main():
        """Main execution function."""
        print(f"{COLOR_BOLD}{COLOR_BLUE}--- Starting Tak-Manager Project Setup ---{COLOR_RESET}")
    print(f"Project Root: {PROJECT_ROOT}")
    print(f"Operating System: {platform.system()} ({platform.release()})")
    print("-" * 40)

    # 1. Check Prerequisites
    print(f"{COLOR_BOLD}Step 1: Checking Prerequisites...{COLOR_RESET}")
    check_prerequisites()
    print("-" * 40)

    # 2. Setup .env file
    print(f"{COLOR_BOLD}Step 2: Setting up .env file...{COLOR_RESET}")
    setup_env_file()
    print("-" * 40)

    # 3. Install Dependencies
    print(f"{COLOR_BOLD}Step 3: Installing Dependencies...{COLOR_RESET}")
    install_dependencies()
    print("-" * 40)

    print(f"{COLOR_BOLD}{COLOR_GREEN}--- Project Setup Complete! ---{COLOR_RESET}")
    print("You should now be able to run the development server or build the application.")
    # You might want to add instructions here on how to start the app, e.g.
    # print(f"To start the development server, run: {COLOR_YELLOW}npm run dev{COLOR_RESET}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("Setup aborted by user.")
    except Exception as e:
         print_error(f"An unexpected error occurred during setup: {e}") 