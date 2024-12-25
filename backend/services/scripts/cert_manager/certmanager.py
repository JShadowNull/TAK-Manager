import os
import xml.etree.ElementTree as ET
from pathlib import Path
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.run_command import RunCommand
from backend.services.helpers.operation_status import OperationStatus
from backend.routes.socketio import socketio

class CertManager:
    def __init__(self):
        self.run_command = RunCommand()
        self.os_detector = OSDetector()
        self.operation_status = OperationStatus(socketio=socketio, namespace='/cert-manager')
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
    def get_registered_certificates(self, emit_status=True):
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            if emit_status:
                self.operation_status.start_operation(
                    'fetch',
                    'Fetching registered certificates'
                )

            auth_file = self.get_auth_file_path()
            if not os.path.exists(auth_file):
                error_message = f"Authentication file not found at: {auth_file}"
                if emit_status:
                    self.operation_status.fail_operation(
                        'fetch',
                        error_message
                    )
                return []

            try:
                tree = ET.parse(auth_file)
                root = tree.getroot()
                
                # Define the XML namespace
                ns = {'ns': 'http://bbn.com/marti/xml/bindings'}
                
                certificates = []
                # Use namespace in findall
                for user in root.findall('.//ns:User', ns):
                    cert_info = {
                        'identifier': user.get('identifier'),
                        'passwordHashed': user.get('passwordHashed', 'false').lower() == 'true',
                        'role': user.get('role', ''),
                        'groups': []
                    }
                    
                    # Use namespace in findall for groups
                    for group in user.findall('.//ns:groupList', ns):
                        if group.text:
                            cert_info['groups'].append(group.text.strip())
                    
                    # If no groups found, add default group
                    if not cert_info['groups']:
                        cert_info['groups'].append('__ANON__')
                    
                    certificates.append(cert_info)
                
                # Only emit status if requested
                if emit_status:
                    # Emit certificates data
                    self.operation_status.emit_certificates_data(certificates)
                    
                    self.operation_status.complete_operation(
                        'fetch',
                        'Successfully fetched registered certificates',
                        details={'total': len(certificates)}
                    )
                
                return certificates

            except ET.ParseError as e:
                error_message = f"Error parsing XML file: {str(e)}"
                if emit_status:
                    self.operation_status.fail_operation(
                        'fetch',
                        error_message,
                        details={'error': error_message}
                    )
                return []

        except Exception as e:
            error_message = f"Error reading certificates: {str(e)}"
            if emit_status:
                self.operation_status.fail_operation(
                    'fetch',
                    error_message,
                    details={'error': error_message}
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
            
            # Check if the command actually succeeded
            if not result or "Command failed" in str(result) or "error" in str(result).lower():
                self.run_command.emit_log_output(
                    f"Failed to register user {username}: Command execution failed",
                    'cert-manager'
                )
                return False
                
            return True

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
            self.operation_status.emit_cert_operation(
                'delete',
                'started',
                username=username,
                message=f'Starting deletion of certificates for user {username}'
            )

            # First verify the container exists and is running
            verify_container = self.run_command.run_command(
                ["docker", "container", "inspect", container_name],
                namespace='cert-manager'
            )
            if not verify_container:
                self.operation_status.emit_cert_operation(
                    'delete',
                    'failed',
                    username=username,
                    message=f'TAK Server container {container_name} not found or not running'
                )
                return False

            # First unregister the user from UserManager
            command = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            
            # Emit unregistering status
            self.operation_status.emit_cert_operation(
                'delete',
                'in_progress',
                username=username,
                message=f'Unregistering user {username}'
            )
            
            if not self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                namespace='cert-manager'
            ):
                self.operation_status.emit_cert_operation(
                    'delete',
                    'failed',
                    username=username,
                    message=f'Failed to unregister user {username}'
                )
                return False

            # Emit deleting files status
            self.operation_status.emit_cert_operation(
                'delete',
                'in_progress',
                username=username,
                message=f'Deleting certificate files for user {username}'
            )

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
                self.operation_status.emit_cert_operation(
                    'delete',
                    'completed',
                    username=username,
                    message=success_message
                )
                self.run_command.emit_log_output(success_message, 'cert-manager')
                return True
            else:
                error_message = f"Some files remain for user {username}: {remaining_files}"
                self.operation_status.emit_cert_operation(
                    'delete',
                    'failed',
                    username=username,
                    message=error_message
                )
                self.run_command.emit_log_output(error_message, 'cert-manager')
                return False

        except Exception as e:
            error_message = f"Error deleting certificates for user {username}: {str(e)}"
            self.operation_status.emit_cert_operation(
                'delete',
                'failed',
                username=username,
                message=error_message
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
                self.operation_status.fail_cert_creation(
                    error_message,
                    total_certs=1,
                    results=[{
                        'username': username,
                        'message': error_message
                    }]
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Start the operation
            self.operation_status.start_cert_creation(mode='single', total_certs=1)

            # Create the certificates
            self.operation_status.update_cert_creation(
                current_cert=username,
                step='Creating certificate',
                step_progress=0,
                completed_certs=0,
                total_certs=1
            )

            cert_result = self.create_client_certificate(username)
            if not cert_result:
                error_message = f'Failed to create certificates for user {username}'
                self.operation_status.fail_cert_creation(
                    error_message,
                    total_certs=1,
                    results=[{
                        'username': username,
                        'message': error_message
                    }]
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Update progress for registration step
            self.operation_status.update_cert_creation(
                current_cert=username,
                step='Registering user',
                step_progress=50,
                completed_certs=0,
                total_certs=1
            )

            # Register the user
            register_result = self.register_user(username, password, is_admin, groups)
            if not register_result:
                error_message = f'Failed to register user {username}'
                self.operation_status.fail_cert_creation(
                    error_message,
                    total_certs=1,
                    results=[{
                        'username': username,
                        'message': error_message
                    }]
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
            
            # Emit certificates data directly
            self.operation_status.emit_certificates_update(certificates)
            
            # Complete the operation
            self.operation_status.complete_cert_creation(
                total_certs=1,
                results=[{
                    'username': username,
                    'message': success_message
                }]
            )
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error creating certificates for user {username}: {str(e)}"
            self.operation_status.fail_cert_creation(
                error_message,
                total_certs=1,
                results=[{
                    'username': username,
                    'message': error_message
                }]
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

    def delete_main(self, username):
        """Main deletion function that the frontend calls to remove a user completely."""
        try:
            # Start the deletion operation
            self.operation_status.start_cert_deletion(total_certs=1)

            # First verify the user exists
            certificates = self.get_registered_certificates(emit_status=False)
            if not any(cert['identifier'] == username for cert in certificates):
                self.operation_status.fail_cert_deletion(
                    message=f'User {username} not found',
                    total_certs=1
                )
                return {
                    'success': False,
                    'message': f"User {username} not found in registered certificates"
                }
            
            # Delete the certificate
            success = self.delete_certificate(username)
            
            # Get updated certificates list
            certificates = self.get_registered_certificates(emit_status=False)
            self.operation_status.emit_certificates_update(certificates)
            
            if success:
                # Complete the operation
                success_message = f"Successfully deleted user {username} and all associated certificates"
                self.operation_status.complete_cert_deletion(total_certs=1)
                return {
                    'success': True,
                    'message': success_message
                }
            else:
                error_message = f"Failed to delete user {username}"
                self.operation_status.fail_cert_deletion(
                    message=error_message,
                    total_certs=1
                )
                return {
                    'success': False,
                    'message': error_message
                }

        except Exception as e:
            error_message = f"Error during deletion of user {username}: {str(e)}"
            self.operation_status.fail_cert_deletion(
                message=error_message,
                total_certs=1
            )
            return {
                'success': False,
                'message': error_message
            }

    def delete_batch(self, usernames):
        """Delete multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0
            results = []

            # Start batch deletion operation
            self.operation_status.start_cert_deletion(total_certs=total_certs)

            # Get initial certificates list
            certificates = self.get_registered_certificates(emit_status=False)
            
            for username in usernames:
                try:
                    # Verify user exists
                    if not any(cert['identifier'] == username for cert in certificates):
                        results.append({
                            'username': username,
                            'message': f'User {username} not found'
                        })
                        continue

                    # Update progress for current certificate
                    self.operation_status.update_cert_deletion(
                        current_cert=username,
                        completed_certs=completed_certs,
                        total_certs=total_certs
                    )

                    # Delete certificate
                    success = self.delete_certificate(username)
                    
                    if success:
                        completed_certs += 1
                        results.append({
                            'username': username,
                            'message': f'Successfully deleted user {username}'
                        })
                    else:
                        results.append({
                            'username': username,
                            'message': f'Failed to delete user {username}'
                        })

                except Exception as e:
                    results.append({
                        'username': username,
                        'message': str(e)
                    })

            # Get final certificates list
            certificates = self.get_registered_certificates(emit_status=False)
            self.operation_status.emit_certificates_update(certificates)

            # Complete or fail based on results
            if completed_certs == total_certs:
                self.operation_status.complete_cert_deletion(total_certs=total_certs)
                return {
                    'success': True,
                    'message': f'Successfully deleted {completed_certs} certificates',
                    'results': results
                }
            else:
                self.operation_status.fail_cert_deletion(
                    message=f'Deleted {completed_certs} of {total_certs} certificates',
                    completed_certs=completed_certs,
                    total_certs=total_certs
                )
                return {
                    'success': False,
                    'message': f'Failed to delete some certificates',
                    'results': results
                }

        except Exception as e:
            error_message = f"Error during batch deletion: {str(e)}"
            self.operation_status.fail_cert_deletion(
                message=error_message,
                total_certs=total_certs
            )
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
            total_certs = len(certificates)
            completed_certs = 0
            results = []

            # Start batch operation
            self.operation_status.start_cert_creation(
                mode='batch',
                total_certs=total_certs
            )

            for cert_data in certificates:
                try:
                    # Validate certificate data
                    is_valid, error_message = self.validate_cert_data(cert_data)
                    if not is_valid:
                        results.append({
                            'username': cert_data.get('username', 'unknown'),
                            'message': error_message
                        })
                        continue

                    username = cert_data['username']
                    
                    # Update progress for certificate creation
                    self.operation_status.update_cert_creation(
                        current_cert=username,
                        step='Creating certificate',
                        step_progress=0,
                        completed_certs=completed_certs,
                        total_certs=total_certs
                    )

                    # Create certificate
                    cert_result = self.create_client_certificate(username)
                    if not cert_result:
                        results.append({
                            'username': username,
                            'message': f'Failed to create certificate for {username}'
                        })
                        continue

                    # Update progress for registration
                    self.operation_status.update_cert_creation(
                        current_cert=username,
                        step='Registering user',
                        step_progress=50,
                        completed_certs=completed_certs,
                        total_certs=total_certs
                    )

                    # Register user
                    register_result = self.register_user(
                        username=username,
                        password=cert_data.get('password'),
                        is_admin=cert_data.get('is_admin', False),
                        groups=cert_data.get('groups', ['__ANON__'])
                    )

                    if register_result:
                        completed_certs += 1
                        results.append({
                            'username': username,
                            'message': f'Successfully created certificate for {username}'
                        })
                    else:
                        results.append({
                            'username': username,
                            'message': f'Failed to register user {username}'
                        })
                        # Clean up failed registration
                        self.delete_user_certificates(username)

                except Exception as e:
                    results.append({
                        'username': cert_data.get('username', 'unknown'),
                        'message': str(e)
                    })

            # Get final certificates list
            certificates = self.get_registered_certificates(emit_status=False)
            self.operation_status.emit_certificates_update(certificates)

            # Complete or fail based on results
            if completed_certs == total_certs:
                self.operation_status.complete_cert_creation(
                    total_certs=total_certs,
                    results=results
                )
                return {
                    'success': True,
                    'message': f'Successfully created {completed_certs} certificates',
                    'results': results
                }
            else:
                self.operation_status.fail_cert_creation(
                    message=f'Created {completed_certs} of {total_certs} certificates',
                    completed_certs=completed_certs,
                    total_certs=total_certs,
                    results=results
                )
                return {
                    'success': False,
                    'message': f'Failed to create some certificates',
                    'results': results
                }

        except Exception as e:
            error_message = f"Error during batch creation: {str(e)}"
            self.operation_status.fail_cert_creation(
                error_message,
                completed_certs=completed_certs,
                total_certs=total_certs,
                results=results if 'results' in locals() else []
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    def delete_certificate(self, username):
        """Delete a single certificate"""
        try:
            container_name = self.get_container_name()

            # Delete user from UserManager
            cmd = f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", cmd],
                namespace='cert-manager'
            )
            if not result:
                return False

            # Delete certificate files
            cmd = f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", cmd],
                namespace='cert-manager'
            )
            if not result:
                return False

            # If both commands succeeded, consider deletion successful
            return True

        except Exception as e:
            print(f"Error deleting certificate for {username}: {str(e)}")
            return False

    def delete_certificates(self, usernames):
        """Delete multiple certificates"""
        total_certs = len(usernames)
        completed_certs = 0
        
        # Start overall deletion operation
        self.operation_status.start_cert_deletion(total_certs)
        
        for username in usernames:
            # Update progress for current certificate
            self.operation_status.update_cert_deletion(username, completed_certs, total_certs)
            
            # Delete individual certificate
            success = self.delete_certificate(username)
            if success:
                completed_certs += 1
            
        # Complete operation based on results
        if completed_certs == total_certs:
            self.operation_status.complete_cert_deletion(total_certs)
        else:
            self.operation_status.fail_cert_deletion(
                f"Deleted {completed_certs} of {total_certs} certificates",
                completed_certs,
                total_certs
            )
            
        # Always emit updated certificate list after deletion
        certificates = self.get_certificates()
        self.operation_status.emit_certificates_update(certificates)