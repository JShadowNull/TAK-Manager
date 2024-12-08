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
            # Emit deletion started event
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'started',
                'username': username,
                'message': f'Starting deletion of certificates for user {username}'
            }, namespace='/cert-manager')

            cert_dir = self.get_cert_directory()
            if not os.path.exists(cert_dir):
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'failed',
                    'username': username,
                    'message': f'Certificate directory not found at: {cert_dir}'
                }, namespace='/cert-manager')
                return False

            # First unregister the user from UserManager
            container_name = self.get_container_name()
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

            cert_extensions = [
                '-trusted.pem',
                '.csr',
                '.jks',
                '.key',
                '.p12',
                '.pem'
            ]

            deleted_files = []
            for file in os.listdir(cert_dir):
                if file.startswith(username) and any(file.endswith(ext) for ext in cert_extensions):
                    file_path = os.path.join(cert_dir, file)
                    try:
                        os.remove(file_path)
                        deleted_files.append(file)
                    except Exception as e:
                        socketio.emit('cert_operation', {
                            'type': 'delete',
                            'status': 'failed',
                            'username': username,
                            'message': f'Error deleting file {file}: {str(e)}'
                        }, namespace='/cert-manager')
                        return False

            if deleted_files:
                success_message = f"Successfully deleted certificates for user {username}: {', '.join(deleted_files)}"
                socketio.emit('cert_operation', {
                    'type': 'delete',
                    'status': 'completed',
                    'username': username,
                    'message': success_message
                }, namespace='/cert-manager')
                self.run_command.emit_log_output(success_message, 'cert-manager')
                return True
            
            no_files_message = f"No certificate files found for user {username}"
            socketio.emit('cert_operation', {
                'type': 'delete',
                'status': 'completed',
                'username': username,
                'message': no_files_message
            }, namespace='/cert-manager')
            self.run_command.emit_log_output(no_files_message, 'cert-manager')
            return True

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
        """Main creation function that the frontend calls to create a new user."""
        try:
            # Emit start event
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'started',
                'username': username,
                'message': f'Starting certificate creation for user {username}'
            }, namespace='/cert-manager')

            # First verify the user doesn't already exist
            certificates = self.get_registered_certificates()
            if any(cert['identifier'] == username for cert in certificates):
                # Emit failure event
                socketio.emit('cert_operation', {
                    'type': 'create',
                    'status': 'failed',
                    'username': username,
                    'message': f'User {username} already exists'
                }, namespace='/cert-manager')
                return {
                    'success': False,
                    'message': f"User {username} already exists"
                }
            
            # Validate groups
            if not groups or not isinstance(groups, list) or len(groups) == 0:
                groups = ['__ANON__']
            
            # Emit progress - Creating certificates
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'in_progress',
                'username': username,
                'message': f'Creating certificates for user {username}'
            }, namespace='/cert-manager')

            # Create the certificates
            if not self.create_client_certificate(username):
                # Emit failure event
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

            # Emit progress - Registering user
            socketio.emit('cert_operation', {
                'type': 'create',
                'status': 'in_progress',
                'username': username,
                'message': f'Registering user {username}'
            }, namespace='/cert-manager')

            # Register the user
            if not self.register_user(username, password, is_admin, groups):
                # Emit failure event
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
                f"with groups: {', '.join(groups)}"
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
            error_message = f"Error during creation of user {username}: {str(e)}"
            # Emit error event
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