import os
import xml.etree.ElementTree as ET
from pathlib import Path
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio

class CertManager:
    def __init__(self):
        self.run_command = RunCommand()
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()

    # Directory and Path Methods
    def get_default_working_directory(self):
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type in ['windows', 'macos']:
            documents_dir = os.path.join(home_dir, 'Documents')
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            working_dir = os.path.join(home_dir, 'takserver-docker')
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
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return os.path.join(self.working_dir, f"takserver-docker-{version}", "tak", "UserAuthenticationFile.xml")

    def get_container_name(self):
        """Get the TAK Server container name based on version."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return f"takserver-{version}"

    # Certificate Management Methods
    def get_registered_certificates(self):
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            auth_file = self.get_auth_file_path()
            if not os.path.exists(auth_file):
                self.run_command.emit_log_output(
                    f"Authentication file not found at: {auth_file}",
                    'cert-manager'
                )
                return []

            tree = ET.parse(auth_file)
            root = tree.getroot()
            ns = {'ns': 'http://bbn.com/marti/xml/bindings'}
            
            certificates = []
            for user in root.findall('.//ns:User', ns):
                cert_info = {
                    'identifier': user.get('identifier'),
                    'passwordHashed': user.get('passwordHashed') == 'true',
                    'role': user.get('role'),
                    'groups': []
                }
                
                for group in user.findall('.//ns:groupList', ns):
                    cert_info['groups'].append(group.text)
                
                certificates.append(cert_info)
            
            # Emit certificates data without fingerprints
            socketio.emit('certificates_data', 
                {'certificates': certificates}, 
                namespace='/cert-manager'
            )
            
            return certificates

        except ET.ParseError as e:
            self.run_command.emit_log_output(
                f"Error parsing XML file: {str(e)}", 
                'cert-manager'
            )
            return []
        except Exception as e:
            self.run_command.emit_log_output(
                f"Error reading certificates: {str(e)}", 
                'cert-manager'
            )
            return []

    def create_client_certificate(self, username):
        """Create client certificates for a user."""
        try:
            container_name = self.get_container_name()
            command = f"cd /opt/tak/certs && yes y | ./makeCert.sh client {username}"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command], 
                namespace='cert-manager'
            )
            return bool(result)

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error creating certificates for user {username}: {str(e)}",
                'cert-manager'
            )
            return False

    def register_user(self, username, password=None, is_admin=False, groups=None):
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
                namespace='cert-manager'
            )
            return bool(result)

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error registering user {username}: {str(e)}",
                'cert-manager'
            )
            return False

    def delete_user_certificates(self, username):
        """Delete all certificate files associated with a given username."""
        try:
            container_name = self.get_container_name()

            # Emit deletion started event
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'started',
                'username': username,
                'message': f'Starting deletion of certificates for user {username}'
            }, namespace='/cert-manager')

            # First verify the container exists and is running
            verify_container = self.run_command.run_command(
                ["docker", "container", "inspect", container_name],
                namespace='cert-manager'
            )
            if not verify_container:
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'TAK Server container {container_name} not found or not running'
                }, namespace='/cert-manager')
                return False

            # First unregister the user from UserManager
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            # Emit unregistering status
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'in_progress',
                'username': username,
                'message': f'Unregistering user {username}'
            }, namespace='/cert-manager')
            
            if not self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                namespace='cert-manager'
            ):
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'Failed to unregister user {username}'
                }, namespace='/cert-manager')
                return False

            # Emit deleting files status
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'in_progress',
                'username': username,
                'message': f'Deleting certificate files for user {username}'
            }, namespace='/cert-manager')

            # Delete all files matching the username pattern in the container
            delete_command = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", delete_command],
                namespace='cert-manager'
            )

            # Verify no files remain
            verify_command = f"find /opt/tak/certs/files/ -name '{username}*' -type f"
            remaining_files = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", verify_command],
                namespace='cert-manager'
            )

            if not remaining_files:
                success_message = f"Successfully deleted certificates for user {username}"
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'completed',
                    'username': username,
                    'message': success_message
                }, namespace='/cert-manager')
                self.run_command.emit_log_output(success_message, 'cert-manager')
                return True
            else:
                error_message = f"Some files remain for user {username}: {remaining_files}"
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': error_message
                }, namespace='/cert-manager')
                self.run_command.emit_log_output(error_message, 'cert-manager')
                return False

        except Exception as e:
            error_message = f"Error deleting certificates for user {username}: {str(e)}"
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'failed',
                'username': username,
                'message': error_message
            }, namespace='/cert-manager')
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
                socketio.emit('cert_operation', {
                    'type': 'create',
                    'status': 'failed',
                    'username': username,
                    'message': error_message
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': error_message
                }

            # Emit start event
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'started',
                'username': username,
                'message': f'Creating certificates for user {username}'
            }, namespace='/cert-manager')

            # Create the certificates
            if not self.create_client_certificate(username):
                socketio.emit('cert_operation', {
                    'type': 'create',
                    'status': 'failed',
                    'username': username,
                    'message': f'Failed to create certificates for user {username}'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"Failed to create certificates for user {username}"
                }

            # Register the user
            if not self.register_user(username, password, is_admin, groups):
                socketio.emit('cert_operation', {
                    'type': 'create',
                    'status': 'failed',
                    'username': username,
                    'message': f'Failed to register user {username}'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"Failed to register user {username}"
                }
            
            success_message = (
                f"Successfully created {'admin' if is_admin else 'user'} {username} "
                f"with groups: {', '.join(groups if groups else ['__ANON__'])}"
            )
            
            # Emit completion event
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'completed',
                'username': username,
                'message': success_message
            }, namespace='/cert-manager')
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error creating certificates for user {username}: {str(e)}"
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'failed',
                'username': username,
                'message': error_message
            }, namespace='/cert-manager')
            return {
                'success': False,
                'message': error_message
            }

    def delete_main(self, username):
        """Main deletion function that the frontend calls to remove a user completely."""
        try:
            # Emit start event
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'started',
                'username': username,
                'message': f'Starting deletion of user {username}'
            }, namespace='/cert-manager')

            # First verify the user exists
            certificates = self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                # Emit failure event
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'User {username} not found'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"User {username} not found in registered certificates"
                }
            
            # Emit progress - Unregistering user
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'in_progress',
                'username': username,
                'message': f'Unregistering user {username}'
            }, namespace='/cert-manager')

            # Delete the user from UserManager
            container_name = self.get_container_name()
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            if not self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                namespace='cert-manager'
            ):
                # Emit failure event
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'Failed to unregister user {username}'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"Failed to unregister user {username}"
                }
            
            # Emit progress - Deleting certificates
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'in_progress',
                'username': username,
                'message': f'Deleting certificates for user {username}'
            }, namespace='/cert-manager')

            # Delete all associated certificate files
            if not self.delete_user_certificates(username):
                # Emit failure event
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'Failed to delete certificates for user {username}'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"User {username} was unregistered but failed to delete certificate files"
                }
            
            success_message = f"Successfully deleted user {username} and all associated certificates"
            
            # Emit completion event
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'completed',
                'username': username,
                'message': success_message
            }, namespace='/cert-manager')
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error during deletion of user {username}: {str(e)}"
            # Emit error event
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'failed',
                'username': username,
                'message': error_message
            }, namespace='/cert-manager')
            return {
                'success': False,
                'message': error_message
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

    def create_batch(self, certificates):
        """Create certificates for multiple users in a batch."""
        try:
            results = []
            success_count = 0
            failure_count = 0

            # Emit batch start event
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'started',
                'message': f'Starting batch creation of {len(certificates)} certificates'
            }, namespace='/cert-manager')

            for cert_data in certificates:
                try:
                    # Validate certificate data
                    is_valid, error_message = self.validate_cert_data(cert_data)
                    if not is_valid:
                        results.append({
                            'username': cert_data.get('username', 'unknown'),
                            'success': False,
                            'message': error_message
                        })
                        failure_count += 1
                        continue

                    # Create certificate with validated data
                    result = self.create_main(
                        username=cert_data['username'],
                        password=cert_data.get('password'),
                        is_admin=cert_data.get('is_admin', False),
                        groups=cert_data.get('groups', ['__ANON__'])
                    )

                    results.append({
                        'username': cert_data['username'],
                        'success': result['success'],
                        'message': result.get('message', 'Certificate created successfully' if result['success'] else 'Failed to create certificate')
                    })

                    if result['success']:
                        success_count += 1
                    else:
                        failure_count += 1

                except Exception as e:
                    results.append({
                        'username': cert_data.get('username', 'unknown'),
                        'success': False,
                        'message': str(e)
                    })
                    failure_count += 1

            # Emit batch completion message
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'batch_completed',
                'message': f'Created {success_count} certificates, {failure_count} failures',
                'success_count': success_count,
                'failure_count': failure_count,
                'total': len(certificates)
            }, namespace='/cert-manager')

            return {
                'status': f'Created {success_count} certificates, {failure_count} failures',
                'results': results
            }

        except Exception as e:
            error_message = f"Error during batch creation: {str(e)}"
            # Emit error event
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'failed',
                'username': 'batch',
                'message': error_message
            }, namespace='/cert-manager')
            return {
                'status': 'failed',
                'results': [],
                'message': error_message
            }