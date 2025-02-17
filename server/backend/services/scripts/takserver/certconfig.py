# backend/services/scripts/certconfig.py

import time
import asyncio
from backend.services.helpers.run_command import RunCommand
import os
from typing import Callable, Dict, Any, Optional
from backend.services.helpers.directories import DirectoryHelper

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
        
    def update_tak_dir(self, tak_dir: str) -> None:
        """Update the TAK directory."""
        self.tak_dir = tak_dir

    def update_working_dir(self, working_dir: str) -> None:
        """Update the working directory."""
        self.working_dir = working_dir

    async def copy_client_cert_to_webaccess(self, container_name: str) -> None:
        """Copy the client certificate to webaccess folder."""
        cert_name = f"{self.name}.p12"
        webaccess_dir = self.directory_helper.get_webaccess_directory()

        # Create directory on host
        mkdir_result = await self.run_command.run_command_async(
            ["mkdir", "-p", webaccess_dir],
            'install',
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not mkdir_result.success:
            raise Exception(mkdir_result.stderr)

        # Copy from container to host
        copy_result = await self.run_command.run_command_async(
            ["docker", "cp", 
             f"{container_name}:/opt/tak/certs/files/{cert_name}",
             f"{webaccess_dir}"],
            'install', 
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not copy_result.success:
            raise Exception(copy_result.stderr)

        # Ensure permissions allow removal on uninstall
        chmod_result = await self.run_command.run_command_async(
            ["chmod", "-R", "755", webaccess_dir],
            'install',
            emit_event=self.emit_event,
            ignore_errors=True
        )
        if not chmod_result.success:
            raise Exception(chmod_result.stderr)

    async def configure_cert_metadata(self, container_name: str) -> None:
        """Configure certificate metadata in TAKServer."""
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
            ignore_errors=True  # Certificate metadata configuration output is not errors
        )
        if not result.success:
            raise Exception(result.stderr)

    async def certificate_generation(self, container_name: str) -> None:
        """Generate certificates for TAKServer."""
        commands = [
            "cd /opt/tak/certs && yes y | ./makeRootCa.sh --ca-name root-ca",
            "cd /opt/tak/certs && yes y | ./makeCert.sh ca intermediate",
            "cd /opt/tak/certs && yes y | ./makeCert.sh server takserver",
            f"cd /opt/tak/certs && yes y | ./makeCert.sh client {self.name}"
        ]
        
        for command in commands:
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", command],
                'install',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            if not result.success:
                raise Exception(result.stderr)

    async def run_certmod(self, container_name: str) -> None:
        """Configure user certificates."""
        # Wait for containers to start with progress updates
        for i in range(15):
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"Waiting for containers to start... {15-i} seconds remaining",
                    "isError": False
                })
            await asyncio.sleep(1)

        retries = 5
        for i in range(1, retries + 1):
            command = f"java -jar /opt/tak/utils/UserManager.jar certmod -A /opt/tak/certs/files/{self.name}.pem"
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", command],
                'install',
                emit_event=self.emit_event,
                ignore_errors=True
            )
            
            if result.success and "Exception" not in result.stdout and "Exception" not in result.stderr:
                return
            
            if i < retries:
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": f"\nRetrying in 5 seconds... (Attempt {i}/{retries} failed)",
                        "isError": True
                    })
                await asyncio.sleep(5)
            else:
                error_message = f"Failed to configure {self.name} user after {retries} attempts"
                raise Exception(error_message)
