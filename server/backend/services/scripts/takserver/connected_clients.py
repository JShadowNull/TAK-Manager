import os
from typing import Dict, Any, Optional, Callable
import xml.etree.ElementTree as ET
from backend.services.helpers.directories import DirectoryHelper
from backend.config.logging_config import configure_logging
from backend.services.scripts.takserver.core_config import CoreConfigManager
from backend.services.helpers.run_command import RunCommand
import time
import asyncio
import json
logger = configure_logging(__name__)

class ConnectedClients:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.directory_helper = DirectoryHelper()
        self.run_command = RunCommand()
        self.emit_event = emit_event
        self.last_clients_hash = None
        self.monitoring_task = None
        self.is_monitoring = False

    async def get_auth_file_path(self) -> str:
        """Get the UserAuthenticationFile.xml path."""
        tak_dir = self.directory_helper.get_tak_directory()
        auth_file = os.path.join(tak_dir, "UserAuthenticationFile.xml")
        
        if not os.path.exists(auth_file):
            logger.error(f"Authentication file not found at: {auth_file}")
            raise FileNotFoundError(f"Authentication file not found at: {auth_file}")
        
        return auth_file

    async def get_admin_user(self) -> Optional[Dict[str, Any]]:
        """Parse UserAuthenticationFile.xml and return the identifier of the first admin user."""
        try:
            logger.debug("Attempting to get the authentication file path.")
            auth_file_path = await self.get_auth_file_path()
            logger.debug(f"Authentication file path retrieved: {auth_file_path}")
            
            tree = ET.parse(auth_file_path)
            root = tree.getroot()
            
            ns = {'ns': 'http://bbn.com/marti/xml/bindings'}
            logger.debug("Parsing UserAuthenticationFile.xml for admin users.")
            
            for user in root.findall('.//ns:User', ns):
                if user.get('role') == 'ROLE_ADMIN':  # Updated to match the XML role
                    logger.debug(f"Admin user found: {user.get('identifier')}")
                    return {
                        'identifier': user.get('identifier'),
                        'role': user.get('role')
                    }  # Return the identifier and role of the first admin user
            
            logger.debug("No admin user found in UserAuthenticationFile.xml.")
            return None  # Return None if no admin user is found
        except Exception as e:
            logger.error(f"Error retrieving admin user: {str(e)}")
            return None  # Handle the error and return None

    async def get_cert_password(self) -> Optional[str]:
        """Retrieve the truststore password from CoreConfig.xml."""
        core_config_manager = CoreConfigManager()
        try:
            xml_content = core_config_manager.read_config()  # Correctly called without parameters
            root = ET.fromstring(xml_content)
            logger.debug("Successfully parsed CoreConfig.xml.")
            
            # Navigate to the security element and get the truststorePass attribute
            security_element = root.find('.//{http://bbn.com/marti/xml/config}security')
            if security_element is not None:
                logger.debug("Security element found.")
                tls_element = security_element.find('{http://bbn.com/marti/xml/config}tls')
                if tls_element is not None:
                    cert_password = tls_element.get('truststorePass')  # Get the truststorePass attribute
                    
                    if cert_password:
                        logger.debug(f"Truststore password found: {cert_password}")
                        return cert_password
                    
                    logger.error("Certificate password not found in CoreConfig.xml")
                    return None
                else:
                    logger.error("TLS element not found in security section.")
                    return None
            else:
                logger.error("Security element not found in CoreConfig.xml")
                return None
        except Exception as e:
            logger.error(f"Error retrieving certificate password: {str(e)}")
            return None

    async def execute_curl_command(self) -> str:
        """Execute curl command to get subscriptions using cert_info and truststore password."""
        try:
            # Wait for the server to be ready before executing the curl command
            server_ready_response = await self.wait_for_server_ready()
            server_ready_data = json.loads(server_ready_response)
            
            # If server is not ready, return the response directly to the API
            if server_ready_data.get("status") == "error":
                logger.error("Server is not ready.")
                return server_ready_response
            
            cert_info = await self.get_admin_user()
            if not cert_info:
                logger.error("No certificate information found.")
                return json.dumps({
                    "status": "error",
                    "message": "No admin certificate information found",
                    "code": "NO_CERT_INFO"
                })
            
            cert_password = await self.get_cert_password()
            if cert_password is None:
                logger.error("Truststore password not found.")
                return json.dumps({
                    "status": "error",
                    "message": "Truststore password not found",
                    "code": "NO_CERT_PASSWORD"
                })
            
            cert_name = cert_info['identifier']  # Assuming 'identifier' is the cert name
            
            # Get TAK Server version for container name
            version = self.directory_helper.get_takserver_version()
            if not version:
                logger.error("Could not determine TAK Server version")
                return json.dumps({
                    "status": "error",
                    "message": "Could not determine TAK Server version",
                    "code": "NO_SERVER_VERSION"
                })
            
            container_name = f"takserver-{version}"
            
            # Create a curl command that handles the password non-interactively
            curl_command = f"curl -k --cert /opt/tak/certs/files/{cert_name}.pem --key /opt/tak/certs/files/{cert_name}.key --pass {cert_password} https://127.0.0.1:8443/Marti/api/subscriptions/all"
            
            # Execute the curl command directly in the container
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", curl_command],
                'subscription_check',
                ignore_errors=True
            )
            
            if not result.success:
                logger.error(f"Curl command failed: {result.stderr}")
                return json.dumps({
                    "status": "error",
                    "message": f"Curl command failed: {result.stderr}",
                    "code": "CURL_COMMAND_FAILED"
                })
            
            # Parse the JSON response from the curl command
            try:
                # First, get the raw data from the curl command
                raw_data = result.stdout.strip()
                
                # Parse the raw data into a Python object
                parsed_data = json.loads(raw_data)
                
                # Extract the client data and clean it up
                clients = []
                if isinstance(parsed_data, dict) and "data" in parsed_data:
                    for client in parsed_data.get("data", []):
                        # Extract only the fields we care about
                        in_groups = []
                        out_groups = []
                        
                        # Process groups to separate IN and OUT groups
                        for group in client.get("groups", []):
                            group_name = group.get("name")
                            direction = group.get("direction")
                            
                            if direction == "IN":
                                in_groups.append(group_name)
                            elif direction == "OUT":
                                out_groups.append(group_name)
                        
                        # Create a simplified client object with only the fields we care about
                        cleaned_client = {
                            "callsign": client.get("callsign"),
                            "takClient": client.get("takClient"),
                            "takVersion": client.get("takVersion"),
                            "inGroups": in_groups,
                            "outGroups": out_groups,
                            "role": client.get("role"),
                            "team": client.get("team"),
                            "ipAddress": client.get("ipAddress", "").strip(),
                            # Keep clientUid for unique identification
                            "clientUid": client.get("clientUid"),
                            # Keep lastReportTime for "last seen" functionality
                            "lastReportTime": client.get("lastReportMilliseconds")
                        }
                        clients.append(cleaned_client)
                
                # Return the cleaned data
                return json.dumps({
                    "status": "success",
                    "clients": clients
                })
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                return json.dumps({
                    "status": "error",
                    "message": f"Failed to parse JSON response: {str(e)}",
                    "code": "JSON_PARSE_ERROR"
                })
        except Exception as e:
            logger.error(f"Error executing curl command: {str(e)}")
            return json.dumps({
                "status": "error",
                "message": f"Error executing curl command: {str(e)}",
                "code": "EXECUTION_ERROR"
            })
        
    async def wait_for_server_ready(self, timeout=180, check_interval=5) -> str:
        """Monitor takserver.log for the final startup message and return JSON status"""
        start_time = time.time()
        ready_message = "Retention Application started"
        
        # Get TAK Server version for container name
        version = self.directory_helper.get_takserver_version()
        if not version:
            logger.error("Could not determine TAK Server version")
            return json.dumps({
                "status": "error",
                "message": "Could not determine TAK Server version",
                "code": "NO_SERVER_VERSION"
            })
            
        container_name = f"takserver-{version}"
        
        while time.time() - start_time < timeout:
            # Check log file for the ready message using proper docker exec command
            log_cmd = "tail -n 50 /opt/tak/logs/takserver.log | grep -a 'Retention Application started'"
            
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", log_cmd],
                'health_check',
                ignore_errors=True
            )
            
            if not result.success:
                logger.error(f"Log command failed: {result.stderr}")
                return json.dumps({
                    "status": "error",
                    "message": f"Log command failed: {result.stderr}",
                    "code": "LOG_CHECK_FAILED"
                })
            
            if ready_message in result.stdout:
                logger.info("✅ TAK Server fully initialized and ready")
                return json.dumps({
                    "status": "success",
                    "message": "TAK Server fully initialized and ready",
                    "code": "SERVER_READY"
                })
            
            # Progress update every 30 seconds
            elapsed = int(time.time() - start_time)
            if elapsed % 30 == 0 and elapsed > 0:
                logger.info(f"⏳ Still waiting for TAK Server initialization ({elapsed}s elapsed)...")
            
            await asyncio.sleep(check_interval)
        
        logger.error("TAK Server initialization timed out")
        return json.dumps({
            "status": "error",
            "message": "TAK Server initialization timed out",
            "code": "SERVER_TIMEOUT"
        })

    async def start_monitoring(self, queue: asyncio.Queue, check_interval: int = 1):
        """Start monitoring connected clients and emit events when changes are detected.
        
        Args:
            queue: The asyncio Queue to put events into
            check_interval: How often to check for changes (in seconds)
        """
        if self.is_monitoring:
            logger.warning("Connected clients monitoring is already running")
            return
            
        self.is_monitoring = True
        logger.info("Starting connected clients monitoring")
        
        try:
            while self.is_monitoring:
                try:
                    # Get current clients
                    result = await self.execute_curl_command()
                    result_data = json.loads(result)
                    
                    if result_data.get("status") == "success":
                        # Calculate a hash of the current clients to detect changes
                        clients = result_data.get("clients", [])
                        
                        # Sort clients by clientUid to ensure consistent comparison
                        clients.sort(key=lambda x: x.get("clientUid", ""))
                        
                        # Create a hash of the clients data
                        current_hash = hash(json.dumps(clients, sort_keys=True))
                        
                        # Only emit an event if the clients have changed
                        if current_hash != self.last_clients_hash:
                            logger.info(f"Connected clients changed: {len(clients)} clients")
                            
                            # Emit the event with the updated clients
                            await queue.put({
                                "event": "connected_clients",
                                "data": json.dumps({
                                    "status": "success",
                                    "clients": clients,
                                    "timestamp": int(time.time() * 1000)
                                })
                            })
                            
                            # Update the last hash
                            self.last_clients_hash = current_hash
                        else:
                            logger.debug("No change in connected clients")
                    else:
                        # If there was an error, emit it once
                        if self.last_clients_hash is not None:
                            logger.warning(f"Error getting connected clients: {result_data.get('message')}")
                            
                            # Emit the error event
                            await queue.put({
                                "event": "connected_clients",
                                "data": json.dumps({
                                    "status": "error",
                                    "message": result_data.get("message", "Unknown error"),
                                    "code": result_data.get("code", "UNKNOWN_ERROR"),
                                    "timestamp": int(time.time() * 1000)
                                })
                            })
                            
                            # Reset the last hash to ensure we emit the next successful result
                            self.last_clients_hash = None
                    
                    # Send a ping every 30 seconds to keep the connection alive
                    await queue.put({
                        "event": "ping",
                        "data": ""
                    })
                    
                except Exception as e:
                    logger.error(f"Error in connected clients monitoring: {str(e)}")
                    
                    # Emit the error event
                    await queue.put({
                        "event": "connected_clients",
                        "data": json.dumps({
                            "status": "error",
                            "message": f"Monitoring error: {str(e)}",
                            "code": "MONITORING_ERROR",
                            "timestamp": int(time.time() * 1000)
                        })
                    })
                    
                    # Reset the last hash to ensure we emit the next successful result
                    self.last_clients_hash = None
                
                # Wait before checking again
                await asyncio.sleep(check_interval)
                
        except asyncio.CancelledError:
            logger.info("Connected clients monitoring cancelled")
        finally:
            self.is_monitoring = False
            logger.info("Connected clients monitoring stopped")
    
    def stop_monitoring(self):
        """Stop the monitoring task."""
        self.is_monitoring = False
        if self.monitoring_task and not self.monitoring_task.done():
            self.monitoring_task.cancel()
            logger.info("Connected clients monitoring task cancelled")