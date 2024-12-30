# backend/services/scripts/certconfig.py

import eventlet
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
            self.run_command.emit_log_output(f"Created webaccess directory at {webaccess_dir}", 'takserver-installer')

        # Copy the client certificate from the container to webaccess directory
        cert_name = f"{self.name}.p12"
        self.run_command.emit_log_output(f"Copying {cert_name} to webaccess directory...", 'takserver-installer')
        
        copy_command = [
            "docker", "cp", 
            f"{container_name}:/opt/tak/certs/files/{cert_name}", 
            os.path.join(webaccess_dir, cert_name)
        ]
        
        success = self.run_command.run_command(copy_command, namespace='takserver-installer')
        
        if success:
            self.run_command.emit_log_output(f"Successfully copied {cert_name} to webaccess directory", 'takserver-installer')
        else:
            raise Exception(f"Failed to copy {cert_name} to webaccess directory")

    def configure_cert_metadata(self, container_name):
        """
        Configure the certificate metadata in TAKServer inside the Docker container.

        This function updates the STATE, CITY, ORGANIZATION, and ORGANIZATIONAL_UNIT values in the cert-metadata.sh file.
        """
        self.run_command.emit_log_output("Starting certificate metadata configuration...", 'takserver-installer')
        
        # Command to set STATE, CITY, ORGANIZATION, and ORGANIZATIONAL_UNIT
        command = f"""
        cd /opt/tak/certs && \\
        sed -i 's/^STATE=.*/STATE={self.state}/' cert-metadata.sh && \\
        sed -i 's/^CITY=.*/CITY={self.city}/' cert-metadata.sh && \\
        sed -i 's/^ORGANIZATION=.*/ORGANIZATION={self.organization}/' cert-metadata.sh && \\
        sed -i 's/^ORGANIZATIONAL_UNIT=.*/ORGANIZATIONAL_UNIT={self.organizational_unit}/' cert-metadata.sh && \\
        sed -i 's/CAPASS=${{CAPASS:-atakatak}}/CAPASS=${{CAPASS:-{self.certificate_password}}}/' cert-metadata.sh
        """

        # Execute the command inside the Docker container
        self.run_command.run_command_no_output(["docker", "exec", container_name, "bash", "-c", command])
        
        self.run_command.emit_log_output("Certificate metadata configuration completed.", 'takserver-installer')

    def certificate_generation(self, container_name):
        self.run_command.emit_log_output("Generating certificates for TAKServer...", 'takserver-installer')
        commands = [
            "cd /opt/tak/certs && yes y | ./makeRootCa.sh --ca-name root-ca",
            "cd /opt/tak/certs && yes y | ./makeCert.sh ca intermediate",
            "cd /opt/tak/certs && yes y | ./makeCert.sh server takserver",
            f"cd /opt/tak/certs && yes y | ./makeCert.sh client {self.name}"
        ]
        for command in commands:
            self.run_command.run_command(["docker", "exec", container_name, "bash", "-c", command], namespace='takserver-installer')

    def run_certmod(self, container_name):
        # Step 1: Wait 15 seconds to ensure containers are fully started
        self.run_command.emit_log_output("Waiting for containers to fully start (15 seconds)...", 'takserver-installer')
        eventlet.sleep(15)  # Use eventlet's cooperative sleep for initial wait

        retries = 5
        for i in range(1, retries + 1):
            self.run_command.emit_log_output(f"Running certmod (attempt {i} of {retries})...", 'takserver-installer')
            
            # Do not unpack the result, since it's a single boolean
            success = self.run_command.run_command(
                ["docker", "exec", container_name, "bash", "-c", f"java -jar /opt/tak/utils/UserManager.jar certmod -A /opt/tak/certs/files/{self.name}.pem"], 
                namespace='takserver-installer'
            )
            
            if success:
                self.run_command.emit_log_output(f"{self.name} user configured successfully", 'takserver-installer')
                return  # Exit the function if successful
            else:
                self.run_command.emit_log_output(f"Certificate modification failed (attempt {i} of {retries}). Retrying in 5 seconds...", 'takserver-installer')
                eventlet.sleep(5)  # Wait for 5 seconds before retrying

        # If all retries fail, log the failure
        self.run_command.emit_log_output(f"Failed to configure {self.name} user after multiple attempts.", 'takserver-installer')
