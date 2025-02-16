import os
import shutil
import re

class DirectoryHelper:
    @staticmethod
    def get_base_directory():
        """Get the base directory for the application."""
        return '/home/tak-manager'

    @staticmethod
    def get_default_working_directory() -> str:
        """Get the working directory."""
        working_dir = os.path.join(DirectoryHelper.get_base_directory(), 'takserver')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    @staticmethod
    def get_upload_directory():
        """Get the upload directory."""
        upload_dir = os.path.join(DirectoryHelper.get_base_directory(), 'uploads')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
        return upload_dir

    @staticmethod
    def get_temp_extract_directory():
        """Get temporary extraction directory path."""
        return os.path.join(DirectoryHelper.get_default_working_directory(), "temp_extract")

    @staticmethod
    def get_version_file_path():
        """Get path to version.txt in working directory."""
        return os.path.join(DirectoryHelper.get_default_working_directory(), "version.txt")

    @staticmethod
    def get_tak_version_from_extracted(temp_tak_dir: str) -> str:
        """Read version from TAK Server's version.txt file."""
        version_file = os.path.join(temp_tak_dir, "version.txt")
        if not os.path.exists(version_file):
            raise ValueError(f"Version file not found at {version_file}")
        
        with open(version_file, "r") as f:
            version = f.read().strip().lower()
            if not version:
                raise ValueError("Version file is empty")
            return version

    @staticmethod
    def get_takserver_version() -> str:
        """Get TAK Server version from version.txt."""
        version_file_path = DirectoryHelper.get_version_file_path()
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip().lower()
                    if not version:
                        return None
                    return version
            except Exception:
                return None
        return None

    @staticmethod
    def get_standardized_folder_name() -> str:
        """Get standardized folder name for TAK Server installation."""
        version = DirectoryHelper.get_takserver_version()
        if not version:
            raise ValueError("No TAK Server version found")
        return f"takserver-docker-{version}"

    @staticmethod
    def get_tak_directory() -> str:
        """Get TAK directory path for a specific version."""
        version = DirectoryHelper.get_takserver_version()
        if not version:
            raise ValueError("No TAK Server version found")
                
        folder_name = DirectoryHelper.get_standardized_folder_name()
        return os.path.join(DirectoryHelper.get_default_working_directory(), folder_name, "tak")

    @staticmethod
    def get_docker_compose_directory() -> str:
        """Get the docker compose directory for a specific version."""
        version = DirectoryHelper.get_takserver_version()
        if not version:
            raise ValueError("No TAK Server version found")
        return os.path.join(DirectoryHelper.get_default_working_directory(), 
                           DirectoryHelper.get_standardized_folder_name())

    @staticmethod
    def get_core_config_paths(tak_dir: str) -> tuple[str, str]:
        """Get paths for CoreConfig.xml and its example file."""
        return (
            os.path.join(tak_dir, "CoreConfig.xml"),
            os.path.join(tak_dir, "CoreConfig.example.xml")
        )

    @staticmethod
    def ensure_clean_directory(directory: str) -> None:
        """Ensure directory exists and is empty."""
        if os.path.exists(directory):
            shutil.rmtree(directory)
        os.makedirs(directory)

    @staticmethod
    def cleanup_temp_directory() -> None:
        """Clean up temporary extraction directory."""
        temp_dir = DirectoryHelper.get_temp_extract_directory()
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

    @staticmethod
    def get_backups_directory() -> str:
        """Get the directory for configuration backups."""
        backups_dir = os.path.join(DirectoryHelper.get_base_directory(), "config_backups")
        if not os.path.exists(backups_dir):
            os.makedirs(backups_dir)
        return backups_dir

    @staticmethod
    def get_data_packages_directory() -> str:
        """Get the directory for data packages."""
        packages_dir = os.path.join(DirectoryHelper.get_base_directory(), "datapackages")
        if not os.path.exists(packages_dir):
            os.makedirs(packages_dir)
        return packages_dir

    @staticmethod
    def get_webaccess_directory() -> str:
        """Get the webaccess directory for client certificates."""
        webaccess_dir = os.path.join(DirectoryHelper.get_base_directory(), "webaccess")
        if not os.path.exists(webaccess_dir):
            os.makedirs(webaccess_dir)
        return webaccess_dir

    @staticmethod
    def get_host_paths() -> dict:
        """Get host paths for TAK Server installation."""
        base_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
        if not base_dir:
            raise ValueError("TAK_SERVER_INSTALL_DIR environment variable is not set")
        
        folder_name = DirectoryHelper.get_standardized_folder_name()
        host_tak_dir = os.path.join(base_dir, 'tak-manager', 'data', 'takserver', folder_name, "tak")
        host_plugins_dir = os.path.join(host_tak_dir, "webcontent")
        
        return {
            "tak_dir": host_tak_dir,
            "plugins_dir": host_plugins_dir
        }

    @staticmethod
    def convert_path_for_docker(path: str) -> str:
        """Convert Windows-style paths to Docker format."""
        # Convert to forward slashes for consistency
        path = path.replace('\\', '/')
        
        # Detect Windows path by checking for drive letter pattern (e.g., C:/)
        if re.match(r'^[A-Za-z]:', path):
            # Convert Windows drive letter (e.g., C:) to Docker format (/c)
            drive, rest = path.split(':', 1)
            path = f'/{drive.lower()}{rest}'
        return path

    @staticmethod
    def get_generate_inf_script_path() -> str:
        """Get the path for the generate-inf.sh script."""
        script_path = '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
        return script_path
    
    @staticmethod
    def get_cert_directory() -> str:
        """Get the path for the certificate directory."""
        tak_dir = DirectoryHelper.get_tak_directory()  # Use the method to get the TAK directory
        cert_dir = os.path.join(tak_dir, "certs", "files")  # Construct the path using os.path.join
        return cert_dir
