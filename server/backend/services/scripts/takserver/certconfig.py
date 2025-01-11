# backend/services/scripts/certconfig.py

import time
from backend.services.helpers.run_command import RunCommand
import os

class CertConfig:
    def __init__(self, certificate_password, organization, state, city, organizational_unit, name, tak_dir=None, working_dir=None):
        self.run_command = RunCommand()
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.name = name
        self.organizational_unit = organizational_unit
        self.tak_dir = tak_dir
        self.working_dir = working_dir

    def update_tak_dir(self, tak_dir):
        """
        Update the TAK directory after initialization.
        """
        self.tak_dir = tak_dir

    def update_working_dir(self, working_dir):
        """
        Update the working directory after initialization.
        """
        self.working_dir = working_dir

    def copy_client_cert_to_webaccess(self, container_name):
        """
        Copy the client certificate (named with self.name) to a webaccess folder in the working directory.
        """
        if not self.working_dir:
            raise ValueError("Working directory not set. Please set working_dir before proceeding.")

        # Create webaccess directory if it doesn't exist
        webaccess_dir = os.path.join(self.working_dir, "webaccess")
        if not os.path.exists(webaccess_dir):
            os.makedirs(webaccess_dir)
            self.run_command.emit_log_output(
                f"Created webaccess directory at {webaccess_dir}",
                'takserver-installer'
            )

        # Copy the client certificate from the container to webaccess directory
        cert_name = f"{self.name}.p12"
        self.run_command.emit_log_output(
            f"Copying {cert_name} to webaccess directory...",
            'takserver-installer'
        )
        
        copy_command = [
            "docker", "cp", 
            f"{container_name}:/opt/tak/certs/files/{cert_name}", 
            os.path.join(webaccess_dir, cert_name)
        ]
        
        result = self.run_command.run_command(
            copy_command, 
            'takserver-installer',
            capture_output=True
        )
        
        if not result.success:
            raise Exception(f"Failed to copy {cert_name} to webaccess directory: {result.error_message}")

        self.run_command.emit_log_output(
            f"Successfully copied {cert_name} to webaccess directory",
            'takserver-installer'
        )

    def configure_cert_metadata(self, container_name):
        """
        Configure the certificate metadata in TAKServer inside the Docker container.
        """
        self.run_command.emit_log_output(
            "Starting certificate metadata configuration...",
            'takserver-installer'
        )
        
        command = f"""
        cd /opt/tak/certs && \\
        sed -i 's/^STATE=.*/STATE={self.state}/' cert-metadata.sh && \\
        sed -i 's/^CITY=.*/CITY={self.city}/' cert-metadata.sh && \\
        sed -i 's/^ORGANIZATION=.*/ORGANIZATION={self.organization}/' cert-metadata.sh && \\
        sed -i 's/^ORGANIZATIONAL_UNIT=.*/ORGANIZATIONAL_UNIT={self.organizational_unit}/' cert-metadata.sh && \\
        sed -i 's/CAPASS=${{CAPASS:-atakatak}}/CAPASS=${{CAPASS:-{self.certificate_password}}}/' cert-metadata.sh
        """

        result = self.run_command.run_command(
            ["docker", "exec", container_name, "bash", "-c", command],
            'takserver-installer',
            capture_output=True,
            shell=False
        )

        if not result.success:
            raise Exception(f"Failed to configure certificate metadata: {result.error_message}")

        self.run_command.emit_log_output(
            "Certificate metadata configuration completed.",
            'takserver-installer'
        )

    def certificate_generation(self, container_name):
        self.run_command.emit_log_output(
            "Generating certificates for TAKServer...",
            'takserver-installer'
        )
        
        commands = [
            "cd /opt/tak/certs && yes y | ./makeRootCa.sh --ca-name root-ca",
            "cd /opt/tak/certs && yes y | ./makeCert.sh ca intermediate",
            "cd /opt/tak/certs && yes y | ./makeCert.sh server takserver",
            f"cd /opt/tak/certs && yes y | ./makeCert.sh client {self.name}"
        ]
        
        for command in commands:
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", command],
                'takserver-installer',
                capture_output=True
            )
            if not result.success:
                raise Exception(f"Certificate generation failed: {result.error_message}")

    def run_certmod(self, container_name):
        self.run_command.emit_log_output(
            "Waiting for containers to fully start (15 seconds)...",
            'takserver-installer'
        )
        time.sleep(15)

        retries = 5
        for i in range(1, retries + 1):
            self.run_command.emit_log_output(
                f"Running certmod (attempt {i} of {retries})...",
                'takserver-installer'
            )
            
            result = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", f"java -jar /opt/tak/utils/UserManager.jar certmod -A /opt/tak/certs/files/{self.name}.pem"],
                'takserver-installer',
                capture_output=True
            )
            
            if result.success:
                self.run_command.emit_log_output(
                    f"{self.name} user configured successfully",
                    'takserver-installer'
                )
                return
            
            if i < retries:
                self.run_command.emit_log_output(
                    f"Certificate modification failed (attempt {i} of {retries}). Retrying in 5 seconds...",
                    'takserver-installer'
                )
                time.sleep(5)
            else:
                self.run_command.emit_log_output(
                    f"Failed to configure {self.name} user after multiple attempts: {result.error_message}",
                    'takserver-installer',
                    error=True
                )
                raise Exception(f"Failed to configure {self.name} user after {retries} attempts")
