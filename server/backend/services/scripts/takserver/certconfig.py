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
from backend.services.scripts.cert_manager.certmanager import CertManager

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
        emit_event: Optional[Callable[[Dict[str, Any]], None]] = None,
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
        self.cert_manager = CertManager()
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
        # Replace static wait with database schema validation
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n⏳ Validating database schema readiness...",
                "isError": False
            })
        
        async def check_database_ready(max_attempts=12, interval=10):
            """Check if database schema is ready by running SchemaManager validate"""
            for attempt in range(1, max_attempts + 1):
                if self.emit_event and attempt > 1:
                    await self.emit_event({
                        "type": "terminal",
                        "message": f"🔄 Database check attempt {attempt}/{max_attempts}...",
                        "isError": False
                    })
                
                validate_cmd = "java -jar /opt/tak/db-utils/SchemaManager.jar validate"
                result = await self.run_command.run_command_async(
                    ["docker", "exec", container_name, "bash", "-c", validate_cmd],
                    'install',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )
                
                # Check for successful schema validation
                if result.success and "Success" in result.stdout and "shutting down" not in result.stderr:
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": "✅ Database schema validated successfully",
                            "isError": False
                        })
                    return True
                
                if "shutting down" in result.stderr:
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": "⏳ Database is still starting up...",
                            "isError": False
                        })
                
                await asyncio.sleep(interval)
            return False

        # Wait for database to be ready
        if not await check_database_ready():
            error_msg = "Database did not become ready within timeout period"
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ {error_msg}",
                    "isError": True
                })
            raise Exception(error_msg)

        # Now proceed with user registration
        retries = 2
        for attempt in range(1, retries + 1):
            status_msg = f"\n🔄 Attempt {attempt}/{retries}: Adding user {self.name} as admin..."
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": status_msg,
                    "isError": False
                })
            logger.info(status_msg.strip())

            try:
                result = await self.cert_manager.register_user(
                    username=self.name,
                    is_admin=True
                )
                
                if result:
                    success_msg = f"✅ Successfully added user {self.name} as admin"
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": success_msg,
                            "isError": False
                        })
                    logger.info(success_msg.strip())
                    return
                else:
                    raise Exception(f"Failed to add user {self.name} as admin")

            except Exception as e:
                error_message = f"Certmod failed: {str(e)}"
                if attempt < retries:
                    error_message += " - Retrying..."
                    await asyncio.sleep(5)
                    
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": error_message,
                        "isError": True
                    })
                logger.error(error_message.strip())
                
                if attempt == retries:
                    raise Exception(f"Failed to add user after {retries} attempts: {str(e)}")
