# ============================================================================
# Imports
# ============================================================================
import os
import xml.etree.ElementTree as ET
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, Optional
from backend.config.logging_config import configure_logging
import tempfile
from backend.services.helpers.directories import DirectoryHelper
logger = configure_logging(__name__)
# ============================================================================
# CertManager Class
# ============================================================================
class CertManager:
    def __init__(self):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self._last_status = None
        self._last_certificates = None
        self._monitor_task = None
# ============================================================================
# Paths 
# ============================================================================
    def get_container_name(self) -> str:
        """Get TAK Server container name based on version."""
        version = self.directory_helper.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return f"takserver-{version}"

    def get_cert_directory(self):
        """Get the certificate directory path."""
        tak_dir = self.directory_helper.get_tak_directory()
        return os.path.join(tak_dir, "certs", "files")

    async def get_auth_file_path(self):
        """Get the UserAuthenticationFile.xml path."""
        tak_dir = self.directory_helper.get_tak_directory()
        auth_file = os.path.join(tak_dir, "UserAuthenticationFile.xml")
        
        if not os.path.exists(auth_file):
            logger.error(f"Authentication file not found at: {auth_file}")
            raise FileNotFoundError(f"Authentication file not found at: {auth_file}")
        
        return auth_file
# ============================================================================
# Main Functions
# ============================================================================
    async def get_registered_certificates(self) -> list:
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            tree = ET.parse(await self.get_auth_file_path())
            root = tree.getroot()
            
            ns = {'ns': 'http://bbn.com/marti/xml/bindings'}
            certificates = []
            
            for user in root.findall('.//ns:User', ns):
                cert_info = {
                    'identifier': user.get('identifier'),
                    'passwordHashed': user.get('passwordHashed', 'false').lower() == 'true',
                    'role': user.get('role', ''),
                    'groups': []
                }
                
                for group in user.findall('.//ns:groupList', ns):
                    if group.text:
                        cert_info['groups'].append(group.text.strip())
                
                if not cert_info['groups']:
                    cert_info['groups'].append('__ANON__')
                
                certificates.append(cert_info)
            
            return certificates

        except ET.ParseError as e:
            raise Exception("Failed to parse UserAuthenticationFile.xml")
        except Exception as e:
            raise Exception(f"Error reading certificates: {str(e)}")

    async def create_main(self, certificates: list) -> bool:
        """Create multiple certificates in a batch."""
        try:
            total_certs = len(certificates)
            completed_certs = 0

            for cert_data in certificates:
                try:
                    username = cert_data['username']

                    if await self.create_client_certificate(username):
                        try:
                            await self.register_user(
                                username=username,
                                password=cert_data.get('password'),
                                is_admin=cert_data.get('is_admin', False),
                                groups=cert_data.get('groups', ['__ANON__'])
                            )
                            completed_certs += 1
                            continue
                        except Exception:
                            # If registration fails, delete the created certificate files
                            await self.delete_user_certificates(username)  # Cleanup
                            raise  # Re-raise the exception for further handling

                except Exception as e:
                    raise

            return completed_certs == total_certs

        except Exception as e:
            raise

    async def delete_main(self, username: str) -> bool:
        """Delete a user and their certificates."""
        try:
            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                return False

            # Delete the certificates
            return await self.delete_user_certificates(username)

        except Exception as e:
            raise

    async def delete_batch(self, usernames: list) -> bool:
        """Delete multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0

            # Get initial certificates list
            certificates = await self.get_registered_certificates()
            
            for username in usernames:
                try:
                    # Verify user exists
                    if not any(cert['identifier'] == username for cert in certificates):
                        continue

                    # Delete certificate
                    result = await self.delete_main(username)
                    
                    if result:
                        completed_certs += 1

                except Exception as e:
                    raise

            return completed_certs == total_certs

        except Exception as e:
            raise Exception(f"Error during batch delete: {str(e)}")
# ============================================================================
# Create Functions
# ============================================================================
    async def create_client_certificate(self, username: str) -> bool:
        """Create client certificates for a user."""
        try:
            logger.debug(f"Attempting to create client certificate for user: {username}")
            
            # Check if the user already exists
            certificates = await self.get_registered_certificates()
            if any(cert['identifier'] == username for cert in certificates):
                raise Exception(f"User {username} already exists.")
            
            container_name = self.get_container_name()
            command = ["docker", "exec", container_name, "bash", "-c", f"cd /opt/tak/certs && yes y | ./makeCert.sh client {username}"]
            logger.debug(f"Running command: {' '.join(command)}")
            
            result = await self.run_command.run_command_async(
                command=command,
                event_type="create_certs",
                ignore_errors=False
            )
            
            if not result.success:
                raise Exception(f"Failed to create certificate for user {username} : {result.stderr}")

            logger.info(f"Successfully created certificate for user: {username}")
            return True

        except Exception as e:
            logger.error(f"Error creating certificate for user {username}: {str(e)}")
            raise

    async def register_user(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None) -> bool:
        """Register a user with their certificate."""
        try:
            container_name = self.get_container_name()
            cmd_parts = ["java", "-jar", "/opt/tak/utils/UserManager.jar", "certmod"]
            
            if is_admin:
                cmd_parts.append("-A")
                
            if groups:
                for group in groups:
                    cmd_parts.extend(["-g", group])
            else:
                cmd_parts.extend(["-g", "__ANON__"])
                
            if password:
                cmd_parts.extend(["-p", f'"{password}"'])
                
            cmd_parts.append(f"/opt/tak/certs/files/{username}.pem")
            
            command = ["docker", "exec", container_name, "bash", "-c", " ".join(cmd_parts)]
            
            result = await self.run_command.run_command_async(
                command=command,
                event_type="register_cert",
                ignore_errors=False
            )
            
            if not result.success:
                raise Exception(result.stderr or result.stdout or f"Failed to register user {username}")

            return True

        except Exception as e:
            raise
# ============================================================================
# Delete Functions
# ============================================================================
    async def delete_user_certificates(self, username: str) -> bool:
        """Delete certificates for a user."""
        try:
            container_name = self.get_container_name()

            # Delete all files first before unregistering
            delete_command = ["docker", "exec", container_name, "bash", "-c", f"rm -f /opt/tak/certs/files/{username}*"]
            result = await self.run_command.run_command_async(
                command=delete_command,
                event_type="delete_certs",
                ignore_errors=False
            )
            if not result.success:
                raise Exception(f"Failed to delete files for user {username} : {result.stderr}")

            # Unregister the user only after successful file deletion
            unregister_command = ["docker", "exec", container_name, "bash", "-c", f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"]
            result = await self.run_command.run_command_async(
                command=unregister_command,
                event_type="delete_certs",
                ignore_errors=False
            )
            if not result.success:
                raise Exception(f"Failed to unregister user {username} : {result.stderr}")

            return True

        except Exception as e:
            raise
# ============================================================================
# Download Functions
# ============================================================================
    async def download_single(self, username: str) -> bool:
        """Get certificate files for a user"""
        try:
            container_name = self.get_container_name()
            
            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                return False

            # Check if certificate exists in container
            verify_command = ["docker", "exec", container_name, "bash", "-c", f"find /opt/tak/certs/files/ -name '{username}.p12' -type f"]
            result = await self.run_command.run_command_async(
                command=verify_command,
                event_type="download",
                ignore_errors=False
            )

            if not result.stdout:
                return False

            # Copy file from container to temp location
            temp_dir = tempfile.mkdtemp()
            p12_path = os.path.join(temp_dir, f"{username}.p12")
            
            copy_command = ["docker", "cp", f"{container_name}:/opt/tak/certs/files/{username}.p12", p12_path]
            result = await self.run_command.run_command_async(
                command=copy_command,
                event_type="download",
                ignore_errors=False
            )

            if not result.success or not os.path.exists(p12_path):
                return False

            return True

        except Exception as e:
            raise Exception(f"Error getting certificate files for {username}: {str(e)}")

    async def download_batch(self, usernames: list) -> bool:
        """Download multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0

            # Get initial certificates list
            certificates = await self.get_registered_certificates()
            
            for username in usernames:
                try:
                    # Verify user exists
                    if not any(cert['identifier'] == username for cert in certificates):
                        continue

                    # Download certificate
                    result = await self.download_single(username)
                    
                    if result:
                        completed_certs += 1

                except Exception:
                    continue

            return completed_certs == total_certs

        except Exception as e:
            raise Exception(f"Error during batch download: {str(e)}")