import os
import xml.etree.ElementTree as ET
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import json
import time
import asyncio
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

class CertManager:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self.emit_event = emit_event

    def _create_event(self, operation_type: str, status: str, message: str, details: dict = None) -> Dict[str, Any]:
        """Create an event object for SSE"""
        event_data = {
            'status': status,
            'operation': operation_type,
            'message': message,
            'details': details or {},
            'timestamp': time.time()
        }
        logger.debug(f"Created operation status event: {event_data}")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data

    def _create_certificates_event(self, certificates: list) -> Dict[str, Any]:
        """Create a certificates update event"""
        event_data = {
            'status': 'update',
            'type': 'certificates_update',
            'certificates': certificates,
            'timestamp': time.time()
        }
        logger.debug(f"Created certificates update event")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data

    async def status_generator(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate certificate status events."""
        while True:
            try:
                certificates = self.get_registered_certificates()
                event_data = {
                    'type': 'certificate_status',
                    'certificates': certificates,
                    'timestamp': time.time()
                }
                yield {
                    "event": "certificate_status",
                    "data": json.dumps(event_data)
                }
            except Exception as e:
                logger.error(f"Error generating certificate status: {str(e)}")
                yield {
                    "event": "certificate_status",
                    "data": json.dumps({
                        'type': 'error',
                        'message': f'Error getting certificate status: {str(e)}',
                        'certificates': [],
                        'timestamp': time.time()
                    })
                }
            await asyncio.sleep(5)  # Update every 5 seconds

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def get_container_name(self) -> str:
        """Get TAK Server container name based on version."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return f"takserver-{version}"

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        if os.path.exists(version_file_path):
            with open(version_file_path, "r") as version_file:
                return version_file.read().strip()
        return None

    def get_cert_directory(self):
        """Get the certificate directory path."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return os.path.join(self.working_dir, f"takserver-docker-{version}", "certs", "files")

    def get_auth_file_path(self):
        """Get the UserAuthenticationFile.xml path."""
        try:
            version = self.get_takserver_version()
            if not version:
                raise Exception("Could not determine TAK Server version")
            
            auth_file = os.path.join(self.working_dir, f"takserver-docker-{version}", "tak", "UserAuthenticationFile.xml")
            
            if not os.path.exists(auth_file):
                raise Exception(f"Authentication file not found at: {auth_file}")
                
            return auth_file
            
        except Exception as e:
            error_message = f"Error getting auth file path: {str(e)}"
            self._create_event(
                'fetch',
                'error',
                error_message,
                {'error': str(e)}
            )
            raise Exception(error_message)

    def get_registered_certificates(self) -> list:
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            self._create_event(
                'fetch',
                'in_progress',
                'Fetching registered certificates'
            )

            auth_file = self.get_auth_file_path()
            if not os.path.exists(auth_file):
                error_message = f"Authentication file not found at: {auth_file}"
                self._create_event(
                    'fetch',
                    'error',
                    error_message,
                    {'error': error_message}
                )
                return []

            try:
                tree = ET.parse(auth_file)
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
                
                self._create_certificates_event(certificates)
                self._create_event(
                    'fetch',
                    'completed',
                    'Successfully fetched registered certificates',
                    {'total': len(certificates)}
                )
                
                return certificates

            except ET.ParseError as e:
                error_message = f"Error parsing XML file: {str(e)}"
                self._create_event(
                    'fetch',
                    'error',
                    error_message,
                    {'error': error_message}
                )
                return []

        except Exception as e:
            error_message = f"Error reading certificates: {str(e)}"
            self._create_event(
                'fetch',
                'error',
                error_message,
                {'error': error_message}
            )
            return []

    def create_client_certificate(self, username: str) -> bool:
        """Create client certificates for a user."""
        try:
            container_name = self.get_container_name()
            command = f"cd /opt/tak/certs && yes y | ./makeCert.sh client {username}"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                'create',
                emit_event=self.emit_event
            )
            return result.success

        except Exception as e:
            self._create_event(
                'create',
                'error',
                f"Error creating certificates for user {username}",
                {'error': str(e)}
            )
            return False

    def register_user(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None) -> bool:
        """Register a user with their certificate."""
        try:
            container_name = self.get_container_name()
            command = "java -jar /opt/tak/utils/UserManager.jar certmod"
            
            if is_admin:
                command += " -A"
                
            if groups:
                for group in groups:
                    command += f" -g {group}"
            else:
                command += " -g __ANON__"
                
            if password:
                command += f" -p '{password}'"
                
            command += f" /opt/tak/certs/files/{username}.pem"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                'register',
                emit_event=self.emit_event
            )
            
            if not result.success or "Command failed" in str(result.stdout) or "error" in str(result.stdout).lower():
                self._create_event(
                    'register',
                    'error',
                    f"Failed to register user {username}",
                    {'error': 'Command execution failed'}
                )
                return False
                
            return True

        except Exception as e:
            self._create_event(
                'register',
                'error',
                f"Error registering user {username}",
                {'error': str(e)}
            )
            return False

    def delete_user_certificates(self, username: str) -> bool:
        """Delete certificates for a user."""
        try:
            container_name = self.get_container_name()

            # First unregister the user from UserManager
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            self._create_event(
                'delete',
                'in_progress',
                f'Unregistering user {username}',
                {'username': username}
            )
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                'delete',
                emit_event=self.emit_event
            )
            
            if not result.success:
                self._create_event(
                    'delete',
                    'error',
                    f'Failed to unregister user {username}',
                    {'username': username}
                )
                return False

            # Delete all files matching the username pattern
            delete_command = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", delete_command],
                'delete',
                emit_event=self.emit_event
            )

            # Verify no files remain
            verify_command = f"find /opt/tak/certs/files/ -name '{username}*' -type f"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", verify_command],
                'delete',
                emit_event=self.emit_event,
                capture_output=True
            )

            if not result.stdout:
                self._create_event(
                    'delete',
                    'completed',
                    f'Successfully deleted certificates for user {username}',
                    {'username': username}
                )
                return True
            else:
                self._create_event(
                    'delete',
                    'error',
                    f'Some files remain for user {username}',
                    {
                        'username': username,
                        'remaining_files': result.stdout
                    }
                )
                return False

        except Exception as e:
            self._create_event(
                'delete',
                'error',
                f'Error deleting certificates for user {username}',
                {
                    'username': username,
                    'error': str(e)
                }
            )
            return False

    def validate_cert_data(self, cert_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate certificate data."""
        if not isinstance(cert_data, dict):
            return False, "Certificate data must be a dictionary"
            
        username = cert_data.get('username')
        if not username:
            return False, "Username is required"
            
        # Allow hyphens and underscores in username
        if not all(c.isalnum() or c in '-_' for c in username):
            return False, "Username must contain only letters, numbers, hyphens, and underscores"
            
        groups = cert_data.get('groups', ['__ANON__'])
        if not isinstance(groups, list):
            return False, "Groups must be a list"
            
        # Validate each group name
        for group in groups:
            if not isinstance(group, str) or not group.strip():
                return False, "Each group must be a non-empty string"
            if not all(c.isalnum() or c in '-_' for c in group):
                return False, f"Group name '{group}' contains invalid characters"

        # Validate password if provided
        password = cert_data.get('password')
        if password is not None and not isinstance(password, str):
            return False, "Password must be a string"

        # Validate is_admin if provided
        is_admin = cert_data.get('is_admin')
        if is_admin is not None and not isinstance(is_admin, bool):
            return False, "is_admin must be a boolean"
            
        return True, None

    def create_main(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None) -> Dict[str, Any]:
        """Create client certificates for a user."""
        try:
            # Validate certificate data
            cert_data = {
                'username': username,
                'password': password,
                'is_admin': is_admin,
                'groups': groups if groups else ['__ANON__']
            }
            
            is_valid, error_message = self.validate_cert_data(cert_data)
            if not is_valid:
                self._create_event(
                    'create',
                    'error',
                    error_message,
                    {
                        'username': username,
                        'error': error_message
                    }
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Start the operation
            self._create_event(
                'create',
                'started',
                f'Starting certificate creation for user {username}',
                {'username': username}
            )

            # Create the certificates
            self._create_event(
                'create',
                'in_progress',
                f'Creating certificate for user {username}',
                {'username': username}
            )

            cert_result = self.create_client_certificate(username)
            if not cert_result:
                error_message = f'Failed to create certificates for user {username}'
                self._create_event(
                    'create',
                    'error',
                    error_message,
                    {'username': username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Update progress for registration step
            self._create_event(
                'create',
                'in_progress',
                f'Registering user {username}',
                {'username': username}
            )

            # Register the user
            register_result = self.register_user(username, password, is_admin, groups)
            if not register_result:
                error_message = f'Failed to register user {username}'
                self._create_event(
                    'create',
                    'error',
                    error_message,
                    {'username': username}
                )
                # Clean up the created certificate since registration failed
                self.delete_user_certificates(username)
                return {
                    'success': False,
                    'message': error_message
                }
            
            success_message = (
                f"Successfully created {'admin' if is_admin else 'user'} {username} "
                f"with groups: {', '.join(groups if groups else ['__ANON__'])}"
            )
            
            # Get the updated certificates list
            certificates = self.get_registered_certificates()
            
            # Emit certificates data and completion status
            self._create_certificates_event(certificates)
            self._create_event(
                'create',
                'completed',
                success_message,
                {
                    'username': username,
                    'is_admin': is_admin,
                    'groups': groups if groups else ['__ANON__']
                }
            )
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error creating certificates for user {username}: {str(e)}"
            self._create_event(
                'create',
                'error',
                error_message,
                {
                    'username': username,
                    'error': str(e)
                }
            )
            # Try to clean up any partially created certificates
            try:
                self.delete_user_certificates(username)
            except:
                pass
            return {
                'success': False,
                'message': error_message
            }

    def create_batch(self, certificates: list) -> Dict[str, Any]:
        """Create multiple certificates in a batch."""
        try:
            total_certs = len(certificates)
            completed_certs = 0
            results = []

            # Start batch creation operation
            self._create_event(
                'create',
                'started',
                f'Starting batch creation of {total_certs} certificates',
                {'total': total_certs}
            )

            for cert_data in certificates:
                try:
                    # Validate certificate data
                    is_valid, error = self.validate_cert_data(cert_data)
                    if not is_valid:
                        results.append({
                            'username': cert_data.get('username', 'unknown'),
                            'message': error,
                            'status': 'failed'
                        })
                        continue

                    username = cert_data['username']

                    # Update progress
                    self._create_event(
                        'create',
                        'in_progress',
                        f'Creating certificate for user {username}',
                        {
                            'username': username,
                            'progress': {'current': completed_certs, 'total': total_certs}
                        }
                    )

                    if self.create_client_certificate(username):
                        if self.register_user(
                            username=username,
                            password=cert_data.get('password'),
                            is_admin=cert_data.get('is_admin', False),
                            groups=cert_data.get('groups', ['__ANON__'])
                        ):
                            completed_certs += 1
                            results.append({
                                'username': username,
                                'message': 'Certificate created successfully',
                                'status': 'completed'
                            })
                            continue

                    # If we get here, something failed
                    results.append({
                        'username': username,
                        'message': 'Failed to create certificate',
                        'status': 'failed'
                    })
                    self.delete_user_certificates(username)  # Cleanup

                except Exception as e:
                    results.append({
                        'username': cert_data.get('username', 'unknown'),
                        'message': str(e),
                        'status': 'failed'
                    })

            # Get and send final certificates list
            certificates = self.get_registered_certificates()
            self._create_certificates_event(certificates)

            # Send final status
            if completed_certs == total_certs:
                self._create_event(
                    'create',
                    'completed',
                    f'Successfully created {completed_certs} certificates',
                    {
                        'total': total_certs,
                        'completed': completed_certs,
                        'results': results
                    }
                )
            else:
                self._create_event(
                    'create',
                    'error',
                    f'Created {completed_certs} of {total_certs} certificates',
                    {
                        'total': total_certs,
                        'completed': completed_certs,
                        'results': results,
                        'error': 'Some certificates failed to create'
                    }
                )

            return {
                'success': completed_certs == total_certs,
                'message': f'Created {completed_certs} of {total_certs} certificates',
                'results': results
            }

        except Exception as e:
            error_message = f"Error during batch creation: {str(e)}"
            self._create_event(
                'create',
                'error',
                error_message,
                {
                    'error': error_message,
                    'results': results if 'results' in locals() else []
                }
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    def delete_main(self, username: str) -> Dict[str, Any]:
        """Delete a user and their certificates."""
        try:
            # Start the deletion operation
            self._create_event(
                'delete',
                'started',
                f'Starting deletion of user {username}',
                {'username': username}
            )

            # First verify the user exists
            certificates = self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                error_message = f'User {username} not found'
                self._create_event(
                    'delete',
                    'error',
                    error_message,
                    {
                        'username': username,
                        'error': error_message
                    }
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Delete the certificates
            if self.delete_user_certificates(username):
                # Get updated certificates list
                certificates = self.get_registered_certificates()
                self._create_certificates_event(certificates)
                
                success_message = f"Successfully deleted user {username} and all associated certificates"
                self._create_event(
                    'delete',
                    'completed',
                    success_message,
                    {'username': username}
                )
                return {
                    'success': True,
                    'message': success_message
                }
            else:
                error_message = f"Failed to delete user {username}"
                self._create_event(
                    'delete',
                    'error',
                    error_message,
                    {'username': username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

        except Exception as e:
            error_message = f"Error during deletion of user {username}: {str(e)}"
            self._create_event(
                'delete',
                'error',
                error_message,
                {
                    'username': username,
                    'error': str(e)
                }
            )
            return {
                'success': False,
                'message': error_message
            }

    def delete_batch(self, usernames: list) -> Dict[str, Any]:
        """Delete multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0
            results = []

            # Start batch deletion operation
            self._create_event(
                'delete',
                'started',
                f'Starting batch deletion of {total_certs} certificates',
                {'total': total_certs}
            )

            # Get initial certificates list
            certificates = self.get_registered_certificates()
            
            for username in usernames:
                try:
                    # Verify user exists
                    if not any(cert['identifier'] == username for cert in certificates):
                        results.append({
                            'username': username,
                            'message': f'User {username} not found',
                            'status': 'failed'
                        })
                        continue

                    # Update progress
                    self._create_event(
                        'delete',
                        'in_progress',
                        f'Deleting user {username}',
                        {
                            'username': username,
                            'progress': {'current': completed_certs, 'total': total_certs}
                        }
                    )

                    # Delete certificate
                    result = self.delete_main(username)
                    
                    if result['success']:
                        completed_certs += 1
                        results.append({
                            'username': username,
                            'message': f'Successfully deleted user {username}',
                            'status': 'completed'
                        })
                    else:
                        results.append({
                            'username': username,
                            'message': result['message'],
                            'status': 'failed'
                        })

                except Exception as e:
                    results.append({
                        'username': username,
                        'message': str(e),
                        'status': 'failed'
                    })

            # Get final certificates list
            certificates = self.get_registered_certificates()
            self._create_certificates_event(certificates)

            # Send final status
            if completed_certs == total_certs:
                self._create_event(
                    'delete',
                    'completed',
                    f'Successfully deleted {completed_certs} certificates',
                    {
                        'total': total_certs,
                        'completed': completed_certs,
                        'results': results
                    }
                )
                return {
                    'success': True,
                    'message': f'Successfully deleted {completed_certs} certificates',
                    'results': results
                }
            else:
                self._create_event(
                    'delete',
                    'error',
                    f'Deleted {completed_certs} of {total_certs} certificates',
                    {
                        'total': total_certs,
                        'completed': completed_certs,
                        'results': results,
                        'error': 'Some certificates failed to delete'
                    }
                )
                return {
                    'success': False,
                    'message': f'Failed to delete some certificates',
                    'results': results
                }

        except Exception as e:
            error_message = f"Error during batch deletion: {str(e)}"
            self._create_event(
                'delete',
                'error',
                error_message,
                {
                    'error': error_message,
                    'results': results if 'results' in locals() else []
                }
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }