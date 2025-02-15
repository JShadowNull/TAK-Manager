import os
import xml.etree.ElementTree as ET
import subprocess
from typing import Dict, Any, Tuple

class CoreConfigManager:
    def __init__(self):
        self.tak_path = "/home/tak-manager/takserver-docker/takserver-docker-5.3-RELEASE-24/tak"
        self.config_path = os.path.join(self.tak_path, "CoreConfig.xml")
        self.validate_script = os.path.join(self.tak_path, "validateConfig.sh")
        
    def read_config(self) -> str:
        """Read the CoreConfig.xml file"""
        try:
            with open(self.config_path, 'r') as file:
                return file.read()
        except Exception as e:
            raise Exception(f"Error reading CoreConfig.xml: {str(e)}")

    def write_config(self, content: str) -> bool:
        """Write to the CoreConfig.xml file"""
        try:
            # Validate XML format first
            ET.fromstring(content)
            
            # Create backup
            backup_path = f"{self.config_path}.backup"
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as src:
                    with open(backup_path, 'w') as dst:
                        dst.write(src.read())
            
            # Write new content to a temporary file for validation
            temp_path = f"{self.config_path}.temp"
            with open(temp_path, 'w') as file:
                file.write(content)

            # Validate using TAK Server's validation script
            is_valid, error_msg = self._validate_with_xmllint(temp_path)
            if not is_valid:
                os.remove(temp_path)
                raise Exception(f"Invalid TAK Server configuration: {error_msg}")

            # If validation passes, move temp file to actual location
            os.rename(temp_path, self.config_path)
            return True

        except ET.ParseError as e:
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
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
                raise Exception(error_msg)
                
            return True
        except ET.ParseError as e:
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
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
                return False, result.stderr.strip() or "Validation failed"
        except subprocess.SubprocessError as e:
            return False, f"Validation script error: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}" 