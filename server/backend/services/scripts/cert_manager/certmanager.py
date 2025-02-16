import os
import xml.etree.ElementTree as ET
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any, Optional, Callable
import time
import asyncio
from backend.config.logging_config import configure_logging
import tempfile
from backend.services.helpers.directories import DirectoryHelper
# Configure logging using centralized config
logger = configure_logging(__name__)

class CertManager:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.emit_event = emit_event
        self._last_status = None
        self._last_certificates = None
        self._monitor_task = None

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
        try:
            tak_dir = self.directory_helper.get_tak_directory()
            auth_file = os.path.join(tak_dir, "UserAuthenticationFile.xml")
            
            if not os.path.exists(auth_file):
                await self.update_status(
                    "fetch",
                    "error",
                    "Authentication file not found",
                    {"path": auth_file}
                )
                raise Exception(f"Authentication file not found at: {auth_file}")
                
            return auth_file
            
        except Exception as e:
            await self.update_status(
                "fetch",
                "error",
                f"Error getting auth file path: {str(e)}",
                {"error": str(e)}
            )
            raise

    async def start_monitoring(self):
        """Start monitoring certificates for changes."""
        if self._monitor_task is None:
            self._monitor_task = asyncio.create_task(self._monitor_certificates())

    async def stop_monitoring(self):
        """Stop monitoring certificates."""
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None

    async def _monitor_certificates(self):
        """Monitor certificates for changes and emit events when changes are detected."""
        while True:
            try:
                auth_file = await self.get_auth_file_path()
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

                # Only emit if certificates have changed
                if certificates != self._last_certificates:
                    self._last_certificates = certificates
                    if self.emit_event:
                        await self.emit_event({
                            "type": "certificates_update",
                            "certificates": certificates,
                            "timestamp": int(time.time() * 1000)
                        })

            except Exception as e:
                if self.emit_event:
                    await self.emit_event({
                        "type": "status",
                        "operation": "monitor",
                        "status": "error",
                        "message": f"Error monitoring certificates: {str(e)}",
                        "details": {"error": str(e)},
                        "isError": True,
                        "timestamp": int(time.time() * 1000)
                    })

            # Wait before next check
            await asyncio.sleep(2)  # Check every 2 seconds

    async def update_status(self, operation: str, status: str, message: str, details: Dict[str, Any] = None) -> None:
        """Update operation status."""
        if self.emit_event:
            new_status = {
                "type": "status",
                "operation": operation,
                "status": status,
                "message": message,
                "details": details or {},
                "isError": status == "error",
                "timestamp": int(time.time() * 1000)
            }
            
            # Only emit if status has changed
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status

    async def emit_certificates_update(self, certificates: list) -> None:
        """Emit certificates update event."""
        if self.emit_event:
            await self.emit_event({
                "type": "certificates_update",
                "certificates": certificates,
                "timestamp": int(time.time() * 1000)
            })

    async def get_registered_certificates(self) -> list:
        """Parse UserAuthenticationFile.xml and return registered certificate information."""
        try:
            await self.update_status(
                "fetch",
                "in_progress",
                "Fetching registered certificates"
            )

            auth_file = await self.get_auth_file_path()
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
            
            await self.emit_certificates_update(certificates)
            await self.update_status(
                "fetch",
                "complete",
                "Successfully fetched registered certificates",
                {"total": len(certificates)}
            )
            
            return certificates

        except Exception as e:
            logger.error(f"Error reading certificates: {str(e)}")
            await self.update_status(
                "fetch",
                "error",
                f"Error reading certificates: {str(e)}",
                {"error": str(e)}
            )
            return []

    async def create_client_certificate(self, username: str) -> bool:
        """Create client certificates for a user."""
        try:
            container_name = self.get_container_name()
            command = ["docker", "exec", container_name, "bash", "-c", f"cd /opt/tak/certs && yes y | ./makeCert.sh client {username}"]
            
            logger.debug("Creating certificate for user %s in container %s", username, container_name)
            await self.update_status(
                "create_certs",
                "in_progress",
                f"Creating certificate for {username}",
                {"username": username}
            )
            
            result = await self.run_command.run_command_async(
                command=command,
                event_type="create_certs",
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if not result.success:
                logger.error("Failed to create certificate for user %s: %s", username, result.stderr)
                await self.update_status(
                    "create_certs",
                    "error",
                    f"Failed to create certificate for {username}",
                    {"username": username, "error": result.stderr}
                )
                return False

            logger.info("Successfully created certificate for user %s", username)
            return True

        except Exception as e:
            logger.exception("Error creating certificate for user %s", username)
            await self.update_status(
                "create_certs",
                "error",
                f"Error creating certificate for {username}",
                {"username": username, "error": str(e)}
            )
            return False

    async def register_user(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None) -> bool:
        """Register a user with their certificate."""
        try:
            container_name = self.get_container_name()
            cmd_parts = ["java", "-jar", "/opt/tak/utils/UserManager.jar", "certmod"]
            
            if is_admin:
                cmd_parts.append("-A")
                logger.debug("User %s will be registered with admin privileges", username)
                
            if groups:
                for group in groups:
                    cmd_parts.extend(["-g", group])
                logger.debug("User %s will be registered with groups: %s", username, groups)
            else:
                cmd_parts.extend(["-g", "__ANON__"])
                logger.debug("User %s will be registered with default __ANON__ group", username)
                
            if password:
                cmd_parts.extend(["-p", password])
                logger.debug("User %s will be registered with a password", username)
                
            cmd_parts.append(f"/opt/tak/certs/files/{username}.pem")
            
            command = ["docker", "exec", container_name, "bash", "-c", " ".join(cmd_parts)]
            
            logger.debug("Registering user %s with command: %s", username, " ".join(cmd_parts))
            await self.update_status(
                "register_cert",
                "in_progress",
                f"Registering user {username}",
                {"username": username}
            )
            
            result = await self.run_command.run_command_async(
                command=command,
                event_type="register_cert",
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if not result.success:
                logger.error("Failed to register user %s: %s", username, result.stderr)
                await self.update_status(
                    "register_cert",
                    "error",
                    f"Failed to register user {username}",
                    {"username": username, "error": result.stderr}
                )
                return False
            
            logger.info("Successfully registered user %s", username)    
            return True

        except Exception as e:
            logger.exception("Error registering user %s", username)
            await self.update_status(
                "register_cert",
                "error",
                f"Error registering user {username}",
                {"username": username, "error": str(e)}
            )
            return False

    async def delete_user_certificates(self, username: str) -> bool:
        """Delete certificates for a user."""
        try:
            container_name = self.get_container_name()

            await self.update_status(
                "delete_certs",
                "in_progress",
                f"Unregistering user {username}",
                {"username": username}
            )

            # First unregister the user from UserManager
            command = ["docker", "exec", container_name, "bash", "-c", f"java -jar /opt/tak/utils/UserManager.jar usermod -D {username}"]
            result = await self.run_command.run_command_async(
                command=command,
                event_type="delete_certs",
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if not result.success:
                await self.update_status(
                    "delete_certs",
                    "error",
                    f"Failed to unregister user {username}",
                    {"username": username, "error": result.stderr}
                )
                return False

            # Delete all files matching the username pattern
            delete_command = ["docker", "exec", container_name, "bash", "-c", f"rm -f /opt/tak/certs/files/{username}* && echo 'Deleted files for {username}'"]
            result = await self.run_command.run_command_async(
                command=delete_command,
                event_type="delete_certs",
                emit_event=self.emit_event,
                ignore_errors=True
            )

            # Verify no files remain
            verify_command = ["docker", "exec", container_name, "bash", "-c", f"find /opt/tak/certs/files/ -name '{username}*' -type f"]
            result = await self.run_command.run_command_async(
                command=verify_command,
                event_type="delete_certs",
                emit_event=self.emit_event,
                ignore_errors=True
            )

            if not result.stdout:
                await self.update_status(
                    "delete_certs",
                    "complete",
                    f"Successfully deleted certificates for user {username}",
                    {"username": username}
                )
                return True
            else:
                await self.update_status(
                    "delete_certs",
                    "error",
                    f"Some files remain for user {username}",
                    {
                        "username": username,
                        "remaining_files": result.stdout
                    }
                )
                return False

        except Exception as e:
            await self.update_status(
                "delete_certs",
                "error",
                f"Error deleting certificates for user {username}",
                {
                    "username": username,
                    "error": str(e)
                }
            )
            return False

    async def create_main(self, username: str, password: Optional[str] = None, is_admin: bool = False, groups: Optional[list] = None) -> Dict[str, Any]:
        """Create client certificates for a user."""
        try:
            # Start the operation
            await self.update_status(
                "create_certs",
                "in_progress",
                f"Starting certificate creation for user {username}",
                {"username": username}
            )

            # Create the certificates
            cert_result = await self.create_client_certificate(username)
            if not cert_result:
                error_message = f'Failed to create certificates for user {username}'
                await self.update_status(
                    "create_certs",
                    "error",
                    error_message,
                    {"username": username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Register the user
            register_result = await self.register_user(username, password, is_admin, groups)
            if not register_result:
                error_message = f'Failed to register user {username}'
                await self.update_status(
                    "create_certs",
                    "error",
                    error_message,
                    {"username": username}
                )
                # Clean up the created certificate since registration failed
                await self.delete_user_certificates(username)
                return {
                    'success': False,
                    'message': error_message
                }
            
            success_message = (
                f"Successfully created {'admin' if is_admin else 'user'} {username} "
                f"with groups: {', '.join(groups if groups else ['__ANON__'])}"
            )
            
            await self.update_status(
                "create_certs",
                "complete",
                success_message,
                {
                    "username": username,
                    "is_admin": is_admin,
                    "groups": groups if groups else ['__ANON__']
                }
            )
            
            return {
                'success': True,
                'message': success_message
            }

        except Exception as e:
            error_message = f"Error creating certificates for user {username}: {str(e)}"
            await self.update_status(
                "create_certs",
                "error",
                error_message,
                {
                    "username": username,
                    "error": str(e)
                }
            )
            # Try to clean up any partially created certificates
            try:
                await self.delete_user_certificates(username)
            except:
                pass
            return {
                'success': False,
                'message': error_message
            }

    async def create_batch(self, certificates: list) -> Dict[str, Any]:
        """Create multiple certificates in a batch."""
        try:
            total_certs = len(certificates)
            completed_certs = 0
            results = []

            logger.info("Starting batch creation of %d certificates", total_certs)
            await self.update_status(
                "create_certs_batch",
                "in_progress",
                f"Starting batch creation of {total_certs} certificates",
                {"total": total_certs}
            )

            for cert_data in certificates:
                try:
                    username = cert_data['username']
                    logger.debug("Processing certificate %d/%d for user %s", completed_certs + 1, total_certs, username)

                    await self.update_status(
                        "create_certs_batch",
                        "in_progress",
                        f"Creating certificate for user {username}",
                        {
                            "username": username,
                            "completed": completed_certs,
                            "total": total_certs
                        }
                    )

                    if await self.create_client_certificate(username):
                        logger.debug("Certificate created for user %s, proceeding with registration", username)
                        if await self.register_user(
                            username=username,
                            password=cert_data.get('password'),
                            is_admin=cert_data.get('is_admin', False),
                            groups=cert_data.get('groups', ['__ANON__'])
                        ):
                            completed_certs += 1
                            logger.info("Successfully created and registered certificate for user %s", username)
                            results.append({
                                'username': username,
                                'message': 'Certificate created successfully',
                                'status': 'completed'
                            })
                            continue

                    logger.error("Failed to create or register certificate for user %s", username)
                    results.append({
                        'username': username,
                        'message': 'Failed to create certificate',
                        'status': 'failed'
                    })
                    await self.delete_user_certificates(username)  # Cleanup

                except Exception as e:
                    logger.exception("Error processing certificate for user %s", cert_data.get('username', 'unknown'))
                    results.append({
                        'username': cert_data.get('username', 'unknown'),
                        'message': str(e),
                        'status': 'failed'
                    })

            if completed_certs == total_certs:
                logger.info("Successfully completed batch creation of all %d certificates", total_certs)
                await self.update_status(
                    "create_certs_batch",
                    "complete",
                    f"Successfully created {completed_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )
            else:
                logger.warning("Batch creation partially completed: %d/%d certificates created", completed_certs, total_certs)
                await self.update_status(
                    "create_certs_batch",
                    "error",
                    f"Created {completed_certs} of {total_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )

            return {
                'success': completed_certs == total_certs,
                'message': f'Created {completed_certs} of {total_certs} certificates',
                'results': results
            }

        except Exception as e:
            logger.exception("Error during batch creation")
            error_message = f"Error during batch creation: {str(e)}"
            await self.update_status(
                "create_certs_batch",
                "error",
                error_message,
                {
                    "error": error_message,
                    "results": results if 'results' in locals() else []
                }
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    async def delete_main(self, username: str) -> Dict[str, Any]:
        """Delete a user and their certificates."""
        try:
            # Start the deletion operation
            await self.update_status(
                "delete_certs",
                "in_progress",
                f"Starting deletion of user {username}",
                {"username": username}
            )

            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                error_message = f'User {username} not found'
                await self.update_status(
                    "delete_certs",
                    "error",
                    error_message,
                    {"username": username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Delete the certificates
            if await self.delete_user_certificates(username):
                success_message = f"Successfully deleted user {username} and all associated certificates"
                await self.update_status(
                    "delete_certs",
                    "complete",
                    success_message,
                    {"username": username}
                )
                return {
                    'success': True,
                    'message': success_message
                }
            else:
                error_message = f"Failed to delete user {username}"
                await self.update_status(
                    "delete_certs",
                    "error",
                    error_message,
                    {"username": username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

        except Exception as e:
            error_message = f"Error during deletion of user {username}: {str(e)}"
            await self.update_status(
                "delete_certs",
                "error",
                error_message,
                {
                    "username": username,
                    "error": str(e)
                }
            )
            return {
                'success': False,
                'message': error_message
            }

    async def delete_batch(self, usernames: list) -> Dict[str, Any]:
        """Delete multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0
            results = []

            # Start batch deletion operation
            await self.update_status(
                "delete_certs_batch",
                "in_progress",
                f"Starting batch deletion of {total_certs} certificates",
                {"total": total_certs}
            )

            # Get initial certificates list
            certificates = await self.get_registered_certificates()
            
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
                    await self.update_status(
                        "delete_certs_batch",
                        "in_progress",
                        f"Deleting user {username}",
                        {
                            "username": username,
                            "completed": completed_certs,
                            "total": total_certs
                        }
                    )

                    # Delete certificate
                    result = await self.delete_main(username)
                    
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

            # Send final status
            if completed_certs == total_certs:
                await self.update_status(
                    "delete_certs_batch",
                    "complete",
                    f"Successfully deleted {completed_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )
            else:
                await self.update_status(
                    "delete_certs_batch",
                    "error",
                    f"Deleted {completed_certs} of {total_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )

            return {
                'success': completed_certs == total_certs,
                'message': f'Deleted {completed_certs} of {total_certs} certificates',
                'results': results
            }

        except Exception as e:
            error_message = f"Error during batch deletion: {str(e)}"
            await self.update_status(
                "delete_certs_batch",
                "error",
                error_message,
                {
                    "error": error_message,
                    "results": results if 'results' in locals() else []
                }
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }

    async def get_certificate_files(self, username: str) -> Dict[str, Any]:
        """Get certificate files for a user"""
        try:
            container_name = self.get_container_name()
            
            # Start the download operation
            await self.update_status(
                "download",
                "in_progress",
                f"Starting download for user {username}",
                {"username": username}
            )

            # First verify the user exists
            certificates = await self.get_registered_certificates()
            if not any(cert['identifier'] == username for cert in certificates):
                error_message = f'User {username} not found'
                await self.update_status(
                    "download",
                    "error",
                    error_message,
                    {"username": username}
                )
                return {
                    'success': False,
                    'message': error_message
                }

            # Check if certificate exists in container
            verify_command = ["docker", "exec", container_name, "bash", "-c", f"find /opt/tak/certs/files/ -name '{username}.p12' -type f"]
            result = await self.run_command.run_command_async(
                command=verify_command,
                event_type="download",
                emit_event=self.emit_event,
                ignore_errors=True
            )

            if not result.stdout:
                await self.update_status(
                    "download",
                    "error",
                    f"Certificate not found for {username}",
                    {"username": username}
                )
                return {'success': False, 'message': f'Certificate not found for {username}'}

            # Copy file from container to temp location
            temp_dir = tempfile.mkdtemp()
            p12_path = os.path.join(temp_dir, f"{username}.p12")
            
            copy_command = ["docker", "cp", f"{container_name}:/opt/tak/certs/files/{username}.p12", p12_path]
            result = await self.run_command.run_command_async(
                command=copy_command,
                event_type="download",
                emit_event=self.emit_event,
                ignore_errors=True
            )

            if not result.success or not os.path.exists(p12_path):
                await self.update_status(
                    "download",
                    "error",
                    f"Failed to copy certificate for {username}",
                    {"username": username, "error": result.stderr}
                )
                return {'success': False, 'message': f'Failed to copy certificate for {username}'}

            # Send completion status
            await self.update_status(
                "download",
                "complete",
                f"Successfully prepared download for {username}",
                {"username": username}
            )
            
            return {
                'success': True,
                'files': {
                    'p12': p12_path
                }
            }

        except Exception as e:
            error_message = f"Error getting certificate files for {username}: {str(e)}"
            await self.update_status(
                "download",
                "error",
                error_message,
                {
                    "username": username,
                    "error": str(e)
                }
            )
            return {'success': False, 'message': error_message}

    async def download_batch(self, usernames: list) -> Dict[str, Any]:
        """Download multiple certificates in a batch."""
        try:
            total_certs = len(usernames)
            completed_certs = 0
            results = []

            # Start batch download operation
            await self.update_status(
                "download_batch",
                "in_progress",
                f"Starting batch download of {total_certs} certificates",
                {"total": total_certs}
            )

            # Get initial certificates list
            certificates = await self.get_registered_certificates()
            
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
                    await self.update_status(
                        "download",
                        "in_progress",
                        f"Downloading certificate for {username}",
                        {
                            "username": username,
                            "completed": completed_certs,
                            "total": total_certs
                        }
                    )

                    # Download certificate
                    result = await self.get_certificate_files(username)
                    
                    if result['success']:
                        completed_certs += 1
                        results.append({
                            'username': username,
                            'message': f'Successfully downloaded certificate for {username}',
                            'status': 'completed',
                            'file_path': result['files']['p12']
                        })
                        
                        # Send individual download complete event
                        await self.update_status(
                            "download",
                            "complete",
                            f"Successfully downloaded certificate for {username}",
                            {
                                "username": username,
                                "file_path": result['files']['p12']
                            }
                        )
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

            # Send final status
            if completed_certs == total_certs:
                await self.update_status(
                    "download_batch",
                    "complete",
                    f"Successfully downloaded {completed_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )
            else:
                await self.update_status(
                    "download_batch",
                    "error",
                    f"Downloaded {completed_certs} of {total_certs} certificates",
                    {
                        "total": total_certs,
                        "completed": completed_certs,
                        "results": results
                    }
                )

            return {
                'success': completed_certs == total_certs,
                'message': f'Downloaded {completed_certs} of {total_certs} certificates',
                'results': results
            }

        except Exception as e:
            error_message = f"Error during batch download: {str(e)}"
            await self.update_status(
                "download_batch",
                "error",
                error_message,
                {
                    "error": error_message,
                    "results": results if 'results' in locals() else []
                }
            )
            return {
                'success': False,
                'message': error_message,
                'results': results if 'results' in locals() else []
            }