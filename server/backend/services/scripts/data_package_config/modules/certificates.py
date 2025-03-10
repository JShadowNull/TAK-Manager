import os
from backend.config.logging_config import configure_logging
from backend.services.helpers.run_command import RunCommand

logger = configure_logging(__name__)

class CertificateManager:
    def __init__(self, directory_helper):
        self.directory_helper = directory_helper
        self.run_command = RunCommand()
        
    async def copy_certificates_from_container(self, temp_dir, ca_certs, client_certs):
        """Copies certificates from the container to the temporary directory"""
        try:
            container_name = f"takserver-{self.directory_helper.get_takserver_version()}"
            # Create cert directory in temp directory
            cert_dir = os.path.join(temp_dir, 'cert')
            os.makedirs(cert_dir, exist_ok=True)

            # Only copy certificates if valid names are provided
            if ca_certs:
                for ca_cert in ca_certs:
                    ca_cert_src = f"/opt/tak/certs/files/{ca_cert}"
                    ca_cert_dest = os.path.join(cert_dir, ca_cert)
                    copy_ca_cert_command = [
                        'docker', 'cp', f"{container_name}:{ca_cert_src}", ca_cert_dest
                    ]
                    result = await self.run_command.run_command_async(
                        command=copy_ca_cert_command,
                        event_type="data-package",
                    )
                    if not result.success:
                        logger.error(f"Failed to copy CA certificate {ca_cert}: {result.stderr}")
                        raise Exception(f"Failed to copy CA certificate {ca_cert}: {result.stderr}")

            if client_certs:
                for client_cert in client_certs:
                    client_cert_src = f"/opt/tak/certs/files/{client_cert}"
                    client_cert_dest = os.path.join(cert_dir, client_cert)
                    copy_client_cert_command = [
                        'docker', 'cp', f"{container_name}:{client_cert_src}", client_cert_dest
                    ]
                    result = await self.run_command.run_command_async(
                        command=copy_client_cert_command,
                        event_type="data-package",
                    )
                    if not result.success:
                        logger.error(f"Failed to copy client certificate {client_cert}: {result.stderr}")
                        raise Exception(f"Failed to copy client certificate {client_cert}: {result.stderr}")

            logger.debug(f"Copied all certificates to {cert_dir}")
        except Exception as e:
            logger.error(f"Certificate copy failed: {str(e)}")
            logger.error("Temporary directory: %s", temp_dir)  # Log temp directory for debugging
            logger.error("CA certificates: %s", ca_certs)  # Log CA certificates for debugging
            logger.error("Client certificates: %s", client_certs)  # Log client certificates for debugging
            raise Exception(f"Certificate transfer error: {str(e)}")

    async def list_cert_files(self) -> list:
        """Lists certificate files in the /opt/tak/certs/files directory"""
        try:
            logger.debug("Listing certificate files in container")
            container_name = f"takserver-{self.directory_helper.get_takserver_version()}"
            
            # Execute command in container
            command = ["docker", "exec", container_name, "ls", "/opt/tak/certs/files"]
            result = await self.run_command.run_command_async(
                command=command,
                event_type="data-package",
            )
            
            if not result.success:
                logger.error(f"Certificate listing failed: {result.stderr}")
                raise Exception(f"Certificate listing failed: {result.stderr}")
            
            cert_files = result.stdout.splitlines()
            logger.debug(f"Found certificate files: {cert_files}")
            return [f for f in cert_files if f.endswith(('.p12', '.pem'))]

        except Exception as e:
            logger.error(f"Certificate listing error: {str(e)}")
            logger.error("Container name: %s", container_name)  # Log container name for debugging
            raise Exception(f"Failed to list certificates: {str(e)}") 