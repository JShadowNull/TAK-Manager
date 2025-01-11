import os
import xml.etree.ElementTree as ET
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from flask_sse import sse
from backend.config.logging_config import configure_logging
import time

# Configure logging using centralized config
logger = configure_logging(__name__)

class CertManager:
    def __init__(self):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()

    def _send_operation_status(self, operation_type: str, status: str, message: str, details: dict = None, channel: str = 'cert-manager'):
        """Send operation status updates via SSE"""
        sse.publish(
            {
                'status': status,
                'operation': operation_type,
                'message': message,
                'details': details or {},
                'timestamp': time.time()
            },
            type='cert_manager_status'
        )

    def _send_certificates_update(self, certificates: list, channel: str = 'cert-manager'):
        """Send updated certificates list via SSE"""
        sse.publish(
            {
                'status': 'update',
                'certificates': certificates,
                'timestamp': time.time()
            },
            type='cert_manager_status'
        )

    def _send_progress_update(self, operation: str, current: int, total: int, message: str, channel: str = 'cert-manager'):
        """Send progress updates via SSE"""
        sse.publish(
            {
                'status': 'in_progress',
                'operation': operation,
                'progress': (current / total) * 100,
                'current': current,
                'total': total,
                'message': message,
                'timestamp': time.time()
            },
            type='cert_manager_status'
        )

    def _send_log_message(self, message: str, error: bool = False, channel: str = 'cert-manager'):
        """Send log messages via SSE"""
        sse.publish(
            {
                'status': 'error' if error else 'log',
                'message': message,
                'timestamp': time.time()
            },
            type='cert_manager_status'
        )

    # Directory and Path Methods
    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

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
            if hasattr(self, 'operation_status'):
                self.operation_status.fail_operation(
                    'fetch',
                    error_message
                )
            raise Exception(error_message)

    def get_container_name(self):
        """Get the TAK Server container name based on version."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return f"takserver-{version}"

    # Certificate Management Methods
    def get_registered_certificates(self, channel: str = 'cert-manager'):
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            self._send_operation_status(
                'fetch',
                'in_progress',
                'Fetching registered certificates',
                channel=channel
            )

            auth_file = self.get_auth_file_path()
            if not os.path.exists(auth_file):
                error_message = f"Authentication file not found at: {auth_file}"
                self._send_operation_status(
                    'fetch',
                    'failed',
                    error_message,
                    {'error': error_message},
                    channel
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
                
                self._send_certificates_update(certificates, channel)
                self._send_operation_status(
                    'fetch',
                    'completed',
                    'Successfully fetched registered certificates',
                    {'total': len(certificates)},
                    channel
                )
                
                return certificates

            except ET.ParseError as e:
                error_message = f"Error parsing XML file: {str(e)}"
                self._send_operation_status(
                    'fetch',
                    'failed',
                    error_message,
                    {'error': error_message},
                    channel
                )
                return []

        except Exception as e:
            error_message = f"Error reading certificates: {str(e)}"
            self._send_operation_status(
                'fetch',
                'failed',
                error_message,
                {'error': error_message},
                channel
            )
            return []

    def create_client_certificate(self, username, channel: str = 'cert-manager'):
        """Create client certificates for a user."""
        try:
            container_name = self.get_container_name()
            command = f"cd /opt/tak/certs && yes y | ./makeCert.sh client {username}"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command], 
                channel=channel
            )
            return bool(result)

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error creating certificates for user {username}: {str(e)}",
                channel,
                error=True
            )
            return False

    def register_user(self, username, password=None, is_admin=False, groups=None, channel: str = 'cert-manager'):
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
                channel=channel
            )
            
            # Check if the command actually succeeded
            if not result or "Command failed" in str(result) or "error" in str(result).lower():
                self.run_command.emit_log_output(
                    f"Failed to register user {username}: Command execution failed",
                    channel
                )
                return False
                
            return True

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error registering user {username}: {str(e)}",
                channel
            )
            return False

    def delete_user_certificates(self, username):
        """Delete all certificate files associated with a given username."""
        try:
            container_name = self.get_container_name()

            # Emit deletion started event
            sse.publish(
                {
                    'status': 'started',
                    'operation': 'delete',
                    'message': f'Starting deletion of certificates for user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # First verify the container exists and is running
            verify_container = self.run_command.run_command(
                ["docker", "container", "inspect", container_name],
                channel=channel
            )
            if not verify_container:
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'delete',
                        'message': f'TAK Server container {container_name} not found or not running',
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return False

            # First unregister the user from UserManager
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            # Emit unregistering status
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Unregistering user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            
            if not self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                channel=channel
            ):
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'delete',
                        'message': f'Failed to unregister user {username}',
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return False

            # Emit deleting files status
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Deleting certificate files for user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # Delete all files matching the username pattern in the container
            delete_command = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", delete_command],
                channel=channel
            )

            # Verify no files remain
            verify_command = f"find /opt/tak/certs/files/ -name '{username}*' -type f"
            remaining_files = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", verify_command],
                channel=channel
            )

            if not remaining_files:
                success_message = f"Successfully deleted certificates for user {username}"
                sse.publish(
                    {
                        'status': 'completed',
                        'operation': 'delete',
                        'message': success_message,
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                self.run_command.emit_log_output(success_message, 'cert-manager')
                return True
            else:
                error_message = f"Some files remain for user {username}: {remaining_files}"
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'delete',
                        'message': error_message,
                        'details': {
                            'username': username,
                            'remaining_files': str(remaining_files)
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                self.run_command.emit_log_output(error_message, 'cert-manager')
                return False

        except Exception as e:
            error_message = f"Error deleting certificates for user {username}: {str(e)}"
            sse.publish(
                {
                    'status': 'error',
                    'operation': 'delete',
                    'message': error_message,
                    'details': {
                        'username': username,
                        'error': str(e)
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            self.run_command.emit_log_output(error_message, 'cert-manager')
            return False

    # Main Interface Methods
    def create_main(self, username, password=None, is_admin=False, groups=None):
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
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'create',
                        'message': error_message,
                        'details': {
                            'username': username,
                            'error': error_message
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Start the operation
            sse.publish(
                {
                    'status': 'started',
                    'operation': 'create',
                    'message': f'Starting certificate creation for user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # Create the certificates
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'create',
                    'message': f'Creating certificate for user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            cert_result = self.create_client_certificate(username)
            if not cert_result:
                error_message = f'Failed to create certificates for user {username}'
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'create',
                        'message': error_message,
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Update progress for registration step
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'create',
                    'message': f'Registering user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # Register the user
            register_result = self.register_user(username, password, is_admin, groups)
            if not register_result:
                error_message = f'Failed to register user {username}'
                sse.publish(
                    {
                        'status': 'error',
                        'operation': 'create',
                        'message': error_message,
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
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
            certificates = self.get_registered_certificates(emit_status=False)
            
            # Emit certificates data and completion status
            self._send_certificates_update(certificates)
            sse.publish(
                {
                    'status': 'completed',
                    'operation': 'create',
                    'message': success_message,
                    'details': {
                        'username': username,
                        'is_admin': is_admin,
                        'groups': groups if groups else ['__ANON__']
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error creating certificates for user {username}: {str(e)}"
            sse.publish(
                {
                    'status': 'error',
                    'operation': 'create', 
                    'message': error_message,
                    'details': {
                        'username': username,
                        'error': str(e)
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
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

    def delete_main(self, username: str, channel: str = 'cert-manager'):
        """Main deletion function that the frontend calls to remove a user completely."""
        try:
            # Start the deletion operation
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Starting deletion of user {username}',
                    'details': {'username': username},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # First verify the user exists
            certificates = self.get_registered_certificates(channel=channel)
            if not any(cert['identifier'] == username for cert in certificates):
                error_message = f'User {username} not found'
                sse.publish(
                    {
                        'status': 'failed',
                        'operation': 'delete',
                        'message': error_message,
                        'details': {
                            'username': username,
                            'error': error_message
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': error_message
                }
            
            # Delete the certificate
            container_name = self.get_container_name()

            # First unregister the user from UserManager
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Unregistering user {username}',
                    'details': {
                        'username': username,
                        'progress': {'current': 0, 'total': 2}
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            
            if not self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                channel=channel
            ):
                error_message = f'Failed to unregister user {username}'
                sse.publish(
                    {
                        'status': 'failed',
                        'operation': 'delete',
                        'message': error_message,
                        'details': {
                            'username': username,
                            'error': error_message
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': error_message
                }

            sse.publish(
                {
                    'status': 'in_progress', 
                    'operation': 'delete',
                    'message': f'Deleting certificate files for {username}',
                    'details': {
                        'username': username,
                        'progress': {'current': 1, 'total': 2}
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # Delete all files matching the username pattern
            delete_command = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", delete_command],
                channel=channel
            )

            # Verify no files remain
            verify_command = f"find /opt/tak/certs/files/ -name '{username}*' -type f"
            remaining_files = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", verify_command],
                channel=channel
            )

            if not remaining_files:
                # Get updated certificates list
                certificates = self.get_registered_certificates(channel=channel)
                self._send_certificates_update(certificates, channel)
                
                success_message = f"Successfully deleted user {username} and all associated certificates"
                sse.publish(
                    {
                        'status': 'completed',
                        'operation': 'delete',
                        'message': success_message,
                        'details': {'username': username},
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': True,
                    'message': success_message
                }
            else:
                error_message = f"Some files remain for user {username}"
                sse.publish(
                    {
                        'status': 'failed',
                        'operation': 'delete',
                        'message': error_message,
                        'details': {
                            'username': username,
                            'error': error_message,
                            'remaining_files': str(remaining_files)
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': error_message
                }

        except Exception as e:
            error_message = f"Error during deletion of user {username}: {str(e)}"
            sse.publish(
                {
                    'status': 'failed',
                    'operation': 'delete',
                    'message': error_message,
                    'details': {
                        'username': username,
                        'error': error_message
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            return {
                'success': False,
                'message': error_message
            }

    def delete_batch(self, usernames: list, channel: str = 'cert-manager'):
        """Delete multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0
            results = []

            # Start batch deletion operation
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Starting batch deletion of {total_certs} certificates',
                    'details': {'total': total_certs},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            # Get initial certificates list
            certificates = self.get_registered_certificates(channel=channel)
            
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
                    sse.publish(
                        {
                            'status': 'in_progress',
                            'operation': 'delete',
                            'message': f'Deleting user {username}',
                            'details': {
                                'username': username,
                                'progress': {'current': completed_certs, 'total': total_certs}
                            },
                            'timestamp': time.time()
                        },
                        type='cert_manager_status'
                    )

                    # Delete certificate
                    result = self.delete_main(username, channel=channel)
                    
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
            certificates = self.get_registered_certificates(channel=channel)
            self._send_certificates_update(certificates, channel)

            # Send final status
            if completed_certs == total_certs:
                sse.publish(
                    {
                        'status': 'completed',
                        'operation': 'delete',
                        'message': f'Successfully deleted {completed_certs} certificates',
                        'details': {
                            'total': total_certs,
                            'completed': completed_certs,
                            'results': results
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': True,
                    'message': f'Successfully deleted {completed_certs} certificates',
                    'results': results
                }
            else:
                sse.publish(
                    {
                        'status': 'failed',
                        'operation': 'delete',
                        'message': f'Deleted {completed_certs} of {total_certs} certificates',
                        'details': {
                            'total': total_certs,
                            'completed': completed_certs,
                            'results': results,
                            'error': 'Some certificates failed to delete'
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
                return {
                    'success': False,
                    'message': f'Failed to delete some certificates',
                    'results': results
                }

        except Exception as e:
            error_message = f"Error during batch deletion: {str(e)}"
            sse.publish(
                {
                    'status': 'failed',
                    'operation': 'delete',
                    'message': error_message,
                    'details': {
                        'error': error_message,
                        'results': results if 'results' in locals() else []
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    def validate_cert_data(self, cert_data):
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

    def validate_batch_inputs(self, base_name, count, group='__ANON__'):
        """Validate batch creation inputs."""
        if not base_name:
            return False, "Base name is required"

        if not all(c.isalnum() or c in '-_' for c in base_name):
            return False, "Base name must contain only letters, numbers, hyphens, and underscores"

        if count < 1:
            return False, "Count must be greater than 0"

        if not isinstance(group, str) or not group.strip():
            return False, "Group must be a non-empty string"

        if not all(c.isalnum() or c in '-_' for c in group):
            return False, f"Group name '{group}' contains invalid characters"

        return True, None

    def create_batch(self, certificates: list, channel: str = 'cert-manager'):
        """Create certificates for multiple users in a batch."""
        try:
            total_certs = len(certificates)
            completed_certs = 0
            results = []

            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'create',
                    'message': f'Starting batch creation of {total_certs} certificates',
                    'details': {'total': total_certs},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )

            for cert_data in certificates:
                try:
                    is_valid, error_message = self.validate_cert_data(cert_data)
                    if not is_valid:
                        results.append({
                            'username': cert_data.get('username', 'unknown'),
                            'message': error_message,
                            'status': 'failed'
                        })
                        continue

                    username = cert_data['username']
                    sse.publish(
                        {
                            'status': 'in_progress',
                            'operation': 'create',
                            'message': f'Creating certificate for {username}',
                            'details': {
                                'username': username,
                                'progress': {'current': completed_certs, 'total': total_certs}
                            },
                            'timestamp': time.time()
                        },
                        type='cert_manager_status'
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
            certificates = self.get_registered_certificates(channel=channel)
            self._send_certificates_update(certificates, channel)

            # Send final status
            if completed_certs == total_certs:
                sse.publish(
                    {
                        'status': 'completed',
                        'operation': 'create',
                        'message': f'Successfully created {completed_certs} certificates',
                        'details': {
                            'total': total_certs,
                            'completed': completed_certs,
                            'results': results
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )
            else:
                sse.publish(
                    {
                        'status': 'failed',
                        'operation': 'create',
                        'message': f'Created {completed_certs} of {total_certs} certificates',
                        'details': {
                            'total': total_certs,
                            'completed': completed_certs,
                            'results': results,
                            'error': 'Some certificates failed to create'
                        },
                        'timestamp': time.time()
                    },
                    type='cert_manager_status'
                )

            return {
                'success': completed_certs == total_certs,
                'message': f'Created {completed_certs} of {total_certs} certificates',
                'results': results
            }

        except Exception as e:
            error_message = f"Error during batch creation: {str(e)}"
            sse.publish(
                {
                    'status': 'failed',
                    'operation': 'create',
                    'message': error_message,
                    'details': {
                        'error': error_message,
                        'results': results if 'results' in locals() else []
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    def delete_certificate(self, username, channel: str = 'cert-manager'):
        """Delete a single certificate"""
        try:
            container_name = self.get_container_name()

            # Delete user from UserManager
            cmd = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", cmd],
                channel=channel
            )
            if not result:
                return False

            # Delete certificate files
            cmd = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", cmd],
                channel=channel
            )
            if not result:
                return False

            # If both commands succeeded, consider deletion successful
            return True

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error deleting certificate for {username}: {str(e)}",
                channel,
                error=True
            )
            return False

    def delete_certificates(self, usernames):
        """Delete multiple certificates"""
        total_certs = len(usernames)
        completed_certs = 0
        
        # Start overall deletion operation
        sse.publish(
            {
                'status': 'in_progress',
                'operation': 'delete',
                'message': f'Starting deletion of {total_certs} certificates',
                'details': {'total': total_certs},
                'timestamp': time.time()
            },
            type='cert_manager_status'
        )
        
        for username in usernames:
            # Update progress for current certificate
            sse.publish(
                {
                    'status': 'in_progress',
                    'operation': 'delete',
                    'message': f'Deleting certificate for {username}',
                    'details': {
                        'username': username,
                        'progress': {'current': completed_certs, 'total': total_certs}
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            
            # Delete individual certificate
            success = self.delete_certificate(username)
            if success:
                completed_certs += 1
            
        # Complete operation based on results
        if completed_certs == total_certs:
            sse.publish(
                {
                    'status': 'completed',
                    'operation': 'delete',
                    'message': f'Successfully deleted {total_certs} certificates',
                    'details': {'total': total_certs},
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
        else:
            sse.publish(
                {
                    'status': 'failed',
                    'operation': 'delete',
                    'message': f'Deleted {completed_certs} of {total_certs} certificates',
                    'details': {
                        'completed': completed_certs,
                        'total': total_certs,
                        'error': 'Some certificates failed to delete'
                    },
                    'timestamp': time.time()
                },
                type='cert_manager_status'
            )
            
        # Always emit updated certificate list after deletion
        certificates = self.get_certificates()
        self._send_certificates_update(certificates)