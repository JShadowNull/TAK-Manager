import os
import xml.etree.ElementTree as ET
import subprocess
from typing import Dict, Any, Tuple, List
from datetime import datetime
import shutil
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper

# Configure logging using centralized config
logger = configure_logging(__name__)

class CoreConfigManager:
    def __init__(self):
        self.directory_helper = DirectoryHelper()
        self.backups_dir = self.directory_helper.get_backups_directory()
            
    def _initialize_paths(self):
        """Initialize paths that require version detection"""
        self.tak_path = self.directory_helper.get_tak_directory()
        self.config_path = os.path.join(self.tak_path, "CoreConfig.xml")
        self.validate_script = os.path.join(self.tak_path, "validateConfig.sh")
        self.init_backup_path = os.path.join(self.backups_dir, "init_backup.xml")

    def ensure_init_backup(self) -> None:
        """Ensure initial backup exists, create if it doesn't"""
        self._initialize_paths()  # Initialize paths before operation
        if not os.path.exists(self.init_backup_path):
            if os.path.exists(self.config_path):
                try:
                    shutil.copy2(self.config_path, self.init_backup_path)
                except Exception as e:
                    logger.error(f"Failed to create initial backup: {str(e)}")
                    raise Exception("Failed to create initial backup")
            else:
                logger.error("CoreConfig.xml not found")
                raise Exception("CoreConfig.xml not found")
            
    def create_backup(self, name: str = "") -> Dict[str, str]:
        """Create a new backup with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{timestamp}_{name}.xml" if name else f"{timestamp}.xml"
        backup_path = os.path.join(self.backups_dir, backup_name)
        
        try:
            shutil.copy2(self.config_path, backup_path)
            return {
                "id": backup_name,
                "name": name or "Backup",
                "timestamp": timestamp,
                "path": backup_path
            }
        except Exception as e:
            logger.error(f"Failed to create backup: {str(e)}")
            raise Exception(f"Failed to create backup: {str(e)}")

    def get_backups(self) -> List[Dict[str, str]]:
        """Get list of all backups"""
        backups = []
        for filename in os.listdir(self.backups_dir):
            if filename.endswith('.xml'):
                file_path = os.path.join(self.backups_dir, filename)
                is_init = filename == "init_backup.xml"
                
                if is_init:
                    backup_info = {
                        "id": filename,
                        "name": "Initial Configuration",
                        "timestamp": datetime.fromtimestamp(os.path.getctime(file_path)).strftime("%Y%m%d_%H%M%S"),
                        "path": file_path,
                        "isInit": True
                    }
                else:
                    # Parse timestamp and name from filename
                    parts = filename.replace('.xml', '').split('_', 2)
                    timestamp = f"{parts[0]}_{parts[1]}"
                    name = parts[2] if len(parts) > 2 else "Backup"
                    
                    backup_info = {
                        "id": filename,
                        "name": name,
                        "timestamp": timestamp,
                        "path": file_path,
                        "isInit": False
                    }
                backups.append(backup_info)
                
        # Sort backups by timestamp, but keep init backup first
        return sorted(backups, key=lambda x: (not x["isInit"], x["timestamp"]))

    def restore_backup(self, backup_id: str) -> bool:
        """Restore configuration from a backup"""
        backup_path = os.path.join(self.backups_dir, backup_id)
        if not os.path.exists(backup_path):
            logger.error("Backup not found")
            raise Exception("Backup not found")
            
        try:
            # Validate backup file first
            with open(backup_path, 'r') as file:
                content = file.read()
            
            # Validate the backup content
            is_valid, error_msg = self._validate_with_xmllint(backup_path)
            if not is_valid:
                logger.error(f"Invalid backup configuration: {error_msg}")
                raise Exception(f"Invalid backup configuration: {error_msg}")
            
            # Restore the backup
            shutil.copy2(backup_path, self.config_path)
            return True
        except Exception as e:
            logger.error(f"Failed to restore backup: {str(e)}")
            raise Exception(f"Failed to restore backup: {str(e)}")

    def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup file"""
        if backup_id == "init_backup.xml":
            logger.error("Cannot delete initial backup")
            raise Exception("Cannot delete initial backup")
            
        backup_path = os.path.join(self.backups_dir, backup_id)
        if not os.path.exists(backup_path):
            logger.error("Backup not found")
            raise Exception("Backup not found")
            
        try:
            os.remove(backup_path)
            return True
        except Exception as e:
            logger.error(f"Failed to delete backup: {str(e)}")
            raise Exception(f"Failed to delete backup: {str(e)}")

    def read_config(self) -> str:
        """Read the CoreConfig.xml file"""
        self._initialize_paths()  # Initialize paths before operation
        try:
            # Ensure init backup exists
            self.ensure_init_backup()
            
            with open(self.config_path, 'r') as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error reading CoreConfig.xml: {str(e)}")
            raise Exception(f"Error reading CoreConfig.xml: {str(e)}")

    def write_config(self, content: str) -> bool:
        """Write to the CoreConfig.xml file"""
        self._initialize_paths()  # Initialize paths before operation
        try:
            # Ensure init backup exists
            self.ensure_init_backup()
            
            # Validate XML format first
            ET.fromstring(content)
            
            # Write new content to a temporary file for validation
            temp_path = f"{self.config_path}.temp"
            with open(temp_path, 'w') as file:
                file.write(content)

            # Validate using TAK Server's validation script
            is_valid, error_msg = self._validate_with_xmllint(temp_path)
            if not is_valid:
                os.remove(temp_path)
                logger.error(f"Invalid TAK Server configuration: {error_msg}")
                raise Exception(f"Invalid TAK Server configuration: {error_msg}")

            # If validation passes, move temp file to actual location
            os.rename(temp_path, self.config_path)
            return True

        except ET.ParseError as e:
            logger.error(f"Invalid XML format: {str(e)}")
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
            logger.error(f"Error writing to CoreConfig.xml: {str(e)}")
            raise Exception(f"Error writing to CoreConfig.xml: {str(e)}")

    def validate_xml(self, content: str) -> bool:
        """Validate XML content using TAK Server's validation script"""
        try:
            # First validate basic XML format
            ET.fromstring(content)
            
            # Write content to temporary file for validation
            temp_path = f"{self.config_path}.temp"
            with open(temp_path, 'w') as file:
                file.write(content)

            # Validate using TAK Server's validation script
            is_valid, error_msg = self._validate_with_xmllint(temp_path)
            
            # Clean up temp file
            os.remove(temp_path)
            
            if not is_valid:
                logger.error(error_msg)
                raise Exception(error_msg)
                
            return True
        except ET.ParseError as e:
            logger.error(f"Invalid XML format: {str(e)}")
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            raise Exception(str(e))

    def _validate_with_xmllint(self, file_path: str) -> Tuple[bool, str]:
        """Run xmllint validation using TAK Server's validation script"""
        try:
            # Make sure the validation script is executable
            if not os.access(self.validate_script, os.X_OK):
                os.chmod(self.validate_script, 0o755)

            # Run the validation script
            result = subprocess.run(
                [self.validate_script, file_path],
                capture_output=True,
                text=True,
                cwd=self.tak_path
            )

            # Check if validation was successful
            if result.returncode == 0:
                return True, ""
            else:
                logger.error(f"Validation failed: {result.stderr.strip()}")
                return False, result.stderr.strip() or "Validation failed"
        except subprocess.SubprocessError as e:
            logger.error(f"Validation script error: {str(e)}")
            return False, f"Validation script error: {str(e)}"
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            return False, f"Validation error: {str(e)}" 