# backend/services/scripts/certconfig.py

import time
import asyncio
from backend.services.helpers.run_command import RunCommand
import os
from typing import Callable, Dict, Any, Optional
from backend.services.helpers.directories import DirectoryHelper
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.config.logging_config import configure_logging
from backend.services.scripts.takserver.fix_database import FixDatabase

logger = configure_logging(__name__)

class CertConfig:
    def __init__(
        self,
        certificate_password: str,
        organization: str,
        state: str,
        city: str,
        organizational_unit: str,
        name: str,
        tak_dir: Optional[str] = None,
        emit_event: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        """Initialize CertConfig with security parameters and system dependencies.
        
        Args:
            certificate_password: Encryption password for certificate files
            organization: Organization name for certificate metadata
            state: State/province for certificate metadata
            city: City/locality for certificate metadata
            organizational_unit: Organizational unit for certificate metadata
            name: Common name for the certificate
            tak_dir: Path to TAK Server installation directory
            emit_event: Callback for real-time event reporting
        """
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.name = name
        self.organizational_unit = organizational_unit
        self.tak_dir = tak_dir
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.emit_event = emit_event
        logger.info("CertConfig initialized for organization: %s", organization)
        
    def update_tak_dir(self, tak_dir: str) -> None:
        """Update the TAK Server installation directory path.
        
        Args:
            tak_dir: New path to TAK Server installation directory
        """
        self.tak_dir = tak_dir
        logger.info("Updated TAK directory to: %s", tak_dir)

    def update_working_dir(self, working_dir: str) -> None:
        """Update the working directory for certificate operations.
        
        Args:
            working_dir: New working directory path
        """
        self.working_dir = working_dir
        logger.info("Updated working directory to: %s", working_dir)

    async def copy_client_cert_to_webaccess(self, container_name: str) -> None:
        """Copy client certificate to web-accessible directory with proper permissions.
        
        Args:
            container_name: Name of Docker container running TAK Server
            
        Raises:
            Exception: If any file operation fails
        """
        cert_name = f"{self.name}.p12"
        webaccess_dir = self.directory_helper.get_webaccess_directory()
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n📁 Starting certificate copy to webaccess directory...",
                "isError": False
            })

        # Create directory on host
        mkdir_result = await self.run_command.run_command_async(
            ["mkdir", "-p", webaccess_dir],
            'install',
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not mkdir_result.success:
            logger.error("Directory creation failed: %s", mkdir_result.stderr)
            raise Exception(f"Webaccess directory creation failed: {mkdir_result.stderr}")

        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "📤 Copying certificate from container...",
                "isError": False
            })
        
        # Copy from container to host
        copy_cmd = [
            "docker", "cp",
            f"{container_name}:/opt/tak/certs/files/{cert_name}",
            f"{webaccess_dir}"
        ]
        copy_result = await self.run_command.run_command_async(
            copy_cmd,
            'install', 
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not copy_result.success:
            logger.error("Certificate copy failed: %s", copy_result.stderr)
            raise Exception(f"Certificate copy failed: {copy_result.stderr}")

        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "🔒 Setting directory permissions...",
                "isError": False
            })
        
        # Set directory permissions
        chmod_result = await self.run_command.run_command_async(
            ["chmod", "-R", "755", webaccess_dir],
            'install',
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not chmod_result.success:
            logger.error("Permission setting failed: %s", chmod_result.stderr)
            raise Exception(f"Permission setting failed: {chmod_result.stderr}")

        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "✅ Successfully copied and secured client certificate",
                "isError": False
            })

    async def configure_cert_metadata(self, container_name: str) -> None:
        """Configure certificate metadata in TAKServer's cert-metadata.sh file.
        
        Args:
            container_name: Name of Docker container running TAK Server
            
        Raises:
            Exception: If metadata configuration fails
        """
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": f"\n🛠️ Configuring certificate metadata for {self.name}...",
                "isError": False
            })
        logger.info("Configuring certificate metadata for %s", self.name)
        command = (
            "cd /opt/tak/certs && "
            f"sed -i 's/^STATE=.*/STATE={self.state}/' cert-metadata.sh && "
            f"sed -i 's/^CITY=.*/CITY={self.city}/' cert-metadata.sh && "
            f"sed -i 's/^ORGANIZATION=.*/ORGANIZATION={self.organization}/' cert-metadata.sh && "
            f"sed -i 's/^ORGANIZATIONAL_UNIT=.*/ORGANIZATIONAL_UNIT={self.organizational_unit}/' cert-metadata.sh && "
            f"sed -i 's/CAPASS=${{CAPASS:-atakatak}}/CAPASS=${{CAPASS:-{self.certificate_password}}}/' cert-metadata.sh"
        )

        result = await self.run_command.run_command_async(
            ["docker", "exec", container_name, "bash", "-c", command],
            'install',
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not result.success:
            logger.error("Metadata configuration failed: %s", result.stderr)
            raise Exception(f"Certificate metadata configuration failed: {result.stderr}")
        
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "✅ Certificate metadata updated successfully",
                "isError": False
            })

    async def certificate_generation(self, container_name: str) -> None:
        """Generate root, intermediate, server, and client certificates."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n🔐 Starting certificate generation process...",
                "isError": False
            })
        logger.info("Starting certificate generation process")
        
        # Tuple format: (step_name, user_message, command)
        commands = [
            ("makeRootCa.sh", 
             "🌳 Generating root CA...", 
             "cd /opt/tak/certs && yes y | ./makeRootCa.sh --ca-name root-ca"),
            
            ("makeIntermediateCert.sh", 
             "🌿 Creating intermediate certificate...", 
             "cd /opt/tak/certs && yes y | ./makeCert.sh ca intermediate"),
            
            ("makeServerCert.sh", 
             "🔧 Building server certificate...", 
             "cd /opt/tak/certs && yes y | ./makeCert.sh server takserver"),
            
            ("makeClientCert.sh", 
             f"📲 Creating client certificate for {self.name}...", 
             f"cd /opt/tak/certs && yes y | ./makeCert.sh client {self.name}")
        ]
        
        for step_name, user_message, command in commands:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"{user_message}",
                    "isError": False
                })
            
            logger.debug("Executing certificate step: %s", step_name)
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", command],
                'install',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            if not result.success:
                logger.critical("Certificate generation failed at %s: %s", step_name, result.stderr)
                raise Exception(f"Certificate generation failed during {step_name}: {result.stderr}")
        
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "🎉 All certificates generated successfully!",
                "isError": False
            })
        logger.info("Successfully generated all certificates")

    async def run_certmod(self, container_name: str) -> None:
        """Configure user certificates by executing certmod command with retry logic."""
        # Database health check
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n🔍 Checking database authentication status (waiting 30s for container startup)...",
                "isError": False
            })
        
        await asyncio.sleep(30)  # Container startup buffer
        tak_status = TakServerStatus(emit_event=self.emit_event)
        db_error_detected = await tak_status._check_database_logs()
        
        if db_error_detected:
            error_msg = "Database authentication error detected (password mismatch)"
            
            # Database repair attempt logic
            if not hasattr(self, 'db_repair_attempted'):
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": "\n⚠️  Attempting database password repair...",
                        "isError": False
                    })
                
                try:
                    fix_db = FixDatabase()
                    await fix_db.fix_database_password()
                    self.db_repair_attempted = True
                    
                    # Re-check database after repair
                    await asyncio.sleep(15)  # Wait for post-repair startup
                    db_error_still_detected = await tak_status._check_database_logs()
                    if db_error_still_detected:
                        raise Exception("Database authentication error persists after repair")
                    
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": "✅ Database repair successful, retrying certificate configuration...",
                            "isError": False
                        })
                except Exception as e:
                    error_msg = f"Database repair failed: {str(e)}"
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": f"❌ Critical error: {error_msg}",
                            "isError": True
                        })
                    logger.critical(error_msg)
                    raise Exception(error_msg)

                # Retry the entire certmod process once after successful repair
                return await self.run_certmod(container_name)

            # If we already attempted repair, throw original error
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error: {error_msg}",
                    "isError": True
                })
            logger.error(error_msg)
            raise Exception(error_msg)

        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "✅ Database authentication valid. Starting certificate configuration...",
                "isError": False
            })

        retries = 2  # Reduced from 5 to 2 attempts
        for attempt in range(1, retries + 1):
            status_msg = f"\n🔄 Attempt {attempt}/{retries}: Adding user {self.name} as admin..."
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": status_msg,
                    "isError": False
                })
            logger.info(status_msg.strip())

            # Construct and execute certmod command with full path to UserManager.jar
            certmod_cmd = (
                f"cd /opt/tak/certs/files && "
                f"java -jar /opt/tak/utils/UserManager.jar certmod -A "  # Full path to JAR
                f"\"{self.name}.pem\""  # Keep quotes for filename
            )
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", certmod_cmd],
                'install',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            # Validate command execution
            if result.success and "Exception" not in result.stdout and "Exception" not in result.stderr:
                success_msg = f"✅ Successfully added user {self.name} as admin"
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": success_msg,
                        "isError": False
                    })
                logger.info(success_msg.strip())
                return

            # Handle retry logic
            if attempt < retries:
                retry_msg = f"⚠️  Configuration attempt {attempt} failed. Retrying in 5 seconds..."
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": retry_msg,
                        "isError": True
                    })
                logger.warning(retry_msg.strip())
                await asyncio.sleep(5)  # Reduced from 10 to 5 seconds
            else:
                error_message = (f"❌ Critical error: Failed to add user {self.name} as admin after {retries} attempts. "
                               f"Final error: {result.stderr or 'Unknown error'}")
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": error_message,
                        "isError": True
                    })
                logger.critical(error_message.strip())
                raise Exception(error_message)
