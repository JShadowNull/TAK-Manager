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
import shutil
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
            logger.error("Could not determine TAK Server version")
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
            logger.error("Failed to parse UserAuthenticationFile.xml")
            raise Exception("Failed to parse UserAuthenticationFile.xml")
        except Exception as e:
            logger.error(f"Error reading certificates: {str(e)}")
            raise Exception(f"Error reading certificates: {str(e)}")

    async def create_main(self, certificates: list) -> dict:
        """Create multiple certificates in a batch."""
        try:
            results = {
                "success": True,
                "total": len(certificates),
                "completed": 0,
                "failed": 0,
                "details": []
            }

            for cert_data in certificates:
                try:
                    username = cert_data['username']
                    is_enrollment = cert_data.get('is_enrollment', False)
                    
                    # Skip certificate creation for enrollment users
                    if is_enrollment:
                        logger.info(f"Skipping certificate creation for enrollment user: {username}")
                        try:
                            # Only register the user (without certificate)
                            await self.register_user(
                                username=username,
                                password=cert_data.get('password'),
                                is_admin=cert_data.get('is_admin', False),
                                groups=cert_data.get('groups', ['__ANON__']),
                                is_enrollment=True
                            )
                            results["completed"] += 1
                            results["details"].append({
                                "username": username,
                                "success": True,
                                "message": "Enrollment user registered successfully"
                            })
                        except Exception as e:
                            error_msg = str(e)
                            logger.error(f"Registration failed for enrollment user {username}: {error_msg}")
                            results["failed"] += 1
                            results["success"] = False
                            results["details"].append({
                                "username": username,
                                "success": False,
                                "message": f"Failed to register enrollment user: {error_msg}"
                            })
                    else:
                        # Regular user with certificate
                        try:
                            if await self.create_client_certificate(username):
                                try:
                                    await self.register_user(
                                        username=username,
                                        password=cert_data.get('password'),
                                        is_admin=cert_data.get('is_admin', False),
                                        groups=cert_data.get('groups', ['__ANON__']),
                                        is_enrollment=False
                                    )
                                    results["completed"] += 1
                                    results["details"].append({
                                        "username": username,
                                        "success": True,
                                        "message": "Certificate created and user registered successfully"
                                    })
                                except Exception as e:
                                    error_msg = str(e)
                                    logger.error(f"Registration failed for user {username}: {error_msg}")
                                    # If registration fails, delete the created certificate files
                                    await self.delete_user_certificates(username)  # Cleanup
                                    results["failed"] += 1
                                    results["success"] = False
                                    results["details"].append({
                                        "username": username,
                                        "success": False,
                                        "message": f"Certificate created but registration failed: {error_msg}"
                                    })
                        except Exception as e:
                            error_msg = str(e)
                            logger.error(f"Failed to create certificate for user {username}: {error_msg}")
                            results["failed"] += 1
                            results["success"] = False
                            results["details"].append({
                                "username": username,
                                "success": False,
                                "message": f"Failed to create certificate: {error_msg}"
                            })

                except Exception as e:
                    error_msg = str(e)
                    username = cert_data.get('username', 'unknown')
                    logger.error(f"Error processing certificate for user {username}: {error_msg}")
                    results["failed"] += 1
                    results["success"] = False
                    results["details"].append({
                        "username": username,
                        "success": False,
                        "message": f"Error processing certificate: {error_msg}"
                    })

            return results

        except Exception as e:
            logger.error(f"Error during certificate creation: {str(e)}")
            return {
                "success": False,
                "message": f"Error during certificate creation: {str(e)}",
                "total": len(certificates),
                "completed": 0,
                "failed": len(certificates)
            }

    async def delete_main(self, username: str) -> bool:
        """Delete a user and their certificates."""
        try:
            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                logger.error(f"User {username} not found for deletion.")
                return False

            # Delete the certificates
            return await self.delete_user_certificates(username)

        except Exception as e:
            logger.error(f"Error during deletion of user {username}: {str(e)}")
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
                        logger.warning(f"User {username} not found for batch deletion.")
                        continue

                    # Delete certificate
                    result = await self.delete_main(username)
                    
                    if result:
                        completed_certs += 1

                except Exception as e:
                    raise

            return completed_certs == total_certs

        except Exception as e:
            logger.error(f"Error during batch delete: {str(e)}")
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
                logger.error(f"User {username} already exists.")
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
                logger.error(f"Failed to create certificate for user {username} : {result.stderr}")
                raise Exception(f"Failed to create certificate for user {username} : {result.stderr}")

            logger.info(f"Successfully created certificate for user: {username}")
            return True

        except Exception as e:
            logger.error(f"Error creating certificate for user {username}: {str(e)}")
            raise

    async def register_user(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None, is_enrollment: bool = False) -> bool:
        """Register a user with their certificate."""
        try:
            # Validate that enrollment users have passwords
            if is_enrollment and not password:
                logger.error(f"Error registering user {username}: Enrollment users require a password")
                raise ValueError("Enrollment users require a password")
                
            container_name = self.get_container_name()
            
            # Different command based on enrollment status
            if is_enrollment:
                # For enrollment users, use usermod instead of certmod
                cmd_parts = ["java", "-jar", "/opt/tak/utils/UserManager.jar", "usermod"]
                
                # For usermod, we add options first, then username at the end
                # Add common parameters for both modes
                if is_admin:
                    cmd_parts.append("-A")
                    
                if groups:
                    for group in groups:
                        cmd_parts.extend(["-g", group])
                else:
                    cmd_parts.extend(["-g", "__ANON__"])
                    
                if password:
                    # Use single quotes as recommended in the documentation
                    cmd_parts.extend(["-p", f"'{password}'"])
                
                # Add username at the end for usermod
                cmd_parts.append(username)
            else:
                # For regular users with certificates, use certmod
                cmd_parts = ["java", "-jar", "/opt/tak/utils/UserManager.jar", "certmod"]
                
                # Common parameters for certmod mode
                if is_admin:
                    cmd_parts.append("-A")
                    
                if groups:
                    for group in groups:
                        cmd_parts.extend(["-g", group])
                else:
                    cmd_parts.extend(["-g", "__ANON__"])
                    
                if password:
                    # Use single quotes as recommended in the documentation
                    cmd_parts.extend(["-p", f"'{password}'"])
                
                # Specify certificate path for regular users at the end
                cmd_parts.append(f"/opt/tak/certs/files/{username}.pem")
            
            command = ["docker", "exec", container_name, "bash", "-c", " ".join(cmd_parts)]
            
            logger.debug(f"Running command: {' '.join(command)}")
            
            result = await self.run_command.run_command_async(
                command=command,
                event_type="register_cert",
                ignore_errors=False
            )
            
            if not result.success:
                logger.error(f"Failed to register user {username}: {result.stderr or result.stdout}")
                raise Exception(result.stderr or result.stdout or f"Failed to register user {username}")

            return True

        except Exception as e:
            logger.error(f"Error registering user {username}: {str(e)}")
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
                logger.error(f"Failed to delete files for user {username} : {result.stderr}")
                raise Exception(f"Failed to delete files for user {username} : {result.stderr}")

            # Unregister the user only after successful file deletion
            unregister_command = ["docker", "exec", container_name, "bash", "-c", f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"]
            result = await self.run_command.run_command_async(
                command=unregister_command,
                event_type="delete_certs",
                ignore_errors=False
            )
            if not result.success:
                logger.error(f"Failed to unregister user {username} : {result.stderr}")
                raise Exception(f"Failed to unregister user {username} : {result.stderr}")

            return True

        except Exception as e:
            logger.error(f"Error deleting certificates for user {username}: {str(e)}")
            raise
# ============================================================================
# Download Functions
# ============================================================================
    async def download_single(self, username: str) -> dict:
        """Get certificate files for a user"""
        try:
            container_name = self.get_container_name()
            
            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                logger.error(f"User {username} not found for download.")
                return {
                    'success': False,
                    'message': f"User {username} not found"
                }

            # Check if certificate exists in container
            verify_command = ["docker", "exec", container_name, "bash", "-c", f"find /opt/tak/certs/files/ -name '{username}.p12' -type f"]
            result = await self.run_command.run_command_async(
                command=verify_command,
                event_type="download",
                ignore_errors=False
            )

            if not result.stdout:
                logger.error(f"Certificate for user {username} not found.")
                return {
                    'success': False,
                    'message': f"Certificate for user {username} not found"
                }

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
                logger.error(f"Failed to copy certificate for user {username}.")
                return {
                    'success': False,
                    'message': f"Failed to copy certificate for user {username}"
                }

            # Return file data as bytes
            with open(p12_path, 'rb') as f:
                file_data = f.read()
            
            # Clean up temp file immediately
            try:
                os.remove(p12_path)
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Temp file cleanup failed: {str(e)}")
            
            return {
                'success': True,
                'filename': f"{username}.p12",
                'data': file_data  # Keep as bytes
            }

        except Exception as e:
            logger.error(f"Error downloading certificate for user {username}: {str(e)}")
            return {
                'success': False,
                'message': str(e)
            }

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
                        logger.warning(f"User {username} not found for batch download.")
                        continue

                    # Download certificate
                    result = await self.download_single(username)
                    
                    if result['success']:
                        completed_certs += 1

                except Exception as e:
                    logger.error(f"Error downloading certificate for user {username}: {str(e)}")
                    continue

            return completed_certs == total_certs

        except Exception as e:
            logger.error(f"Error during batch download: {str(e)}")
            raise Exception(f"Error during batch download: {str(e)}")