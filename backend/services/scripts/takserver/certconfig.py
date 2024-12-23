# backend/services/scripts/certconfig.py

import eventlet
from backend.services.helpers.run_command import RunCommand
import os
from backend.services.helpers.os_detector import OSDetector  # Import OSDetector class

class CertConfig:
    def __init__(self, certificate_password, organization, state, city, organizational_unit, name, tak_dir=None):
        self.run_command = RunCommand()
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.name = name
        self.organizational_unit = organizational_unit
        self.tak_dir = tak_dir
        self.os_detector = OSDetector()  # Initialize OSDetector

    def update_tak_dir(self, tak_dir):
        """
        Update the TAK directory after initialization.
        """
        self.tak_dir = tak_dir

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

    def install_admin_cert_to_keychain(self):
        """
        Installs the {self.name}.p12 certificate to the OS certificate store (Windows, macOS, Linux).
        """
        # Ensure the tak_dir and certificate path exist
        if not self.tak_dir:
            raise ValueError("TAK directory not set. Please set the tak_dir before proceeding.")

        admin_cert_path = os.path.join(self.tak_dir, "certs", "files", f"{self.name}.p12")

        if not os.path.exists(admin_cert_path):
            raise FileNotFoundError(f"Certificate file not found: {admin_cert_path}")

        os_type = self.os_detector.detect_os()

        self.run_command.emit_log_output(f"Installing {self.name} certificate on {os_type}...", 'takserver-installer')

        if os_type == 'macos':
            # Command to import the {self.name}.p12 certificate into the macOS Keychain
            command = [
                "security", "import", admin_cert_path,
                "-k", "login.keychain",       # Importing into the default login keychain
                "-P", self.certificate_password,  # The password for the P12 file
                "-A"                          # Allow all applications to access the key (suitable for website authentication)
            ]
            # Execute the command
            success = self.run_command.run_command(command, namespace='takserver-installer')
            if success:
                self.run_command.emit_log_output("Certificate imported into Keychain successfully.", 'takserver-installer')
            else:
                self.run_command.emit_log_output("Failed to import the certificate into the Keychain.", 'takserver-installer')
        elif os_type == 'windows':
            # Command to import the certificate into Windows Certificate Store
            command = [
                "certutil", "-f", "-p", self.certificate_password, "-importpfx", admin_cert_path
            ]
            # Execute the command
            success = self.run_command.run_command(command, namespace='takserver-installer')
            if success:
                self.run_command.emit_log_output("Certificate imported into Windows Certificate Store successfully.", 'takserver-installer')
            else:
                self.run_command.emit_log_output("Failed to import the certificate into Windows Certificate Store.", 'takserver-installer')
        elif os_type == 'linux':
            # On Linux, certificates are handled differently depending on the distribution and desktop environment.
            # For simplicity, we can copy the certificate to a standard location like /usr/local/share/ca-certificates and update the CA certificates.

            # Install 'ca-certificates' if not installed (requires sudo)
            self.run_command.emit_log_output("Installing required packages for certificate installation...", 'takserver-installer')
            install_command = ["sudo", "apt-get", "install", "-y", "ca-certificates"]
            self.run_command.run_command(install_command, namespace='takserver-installer')

            # Convert P12 to PEM format
            pem_cert_path = os.path.join(self.tak_dir, "certs", "files", f"{self.name}.crt")
            convert_command = [
                "openssl", "pkcs12", "-in", admin_cert_path, "-out", pem_cert_path, "-nodes", "-password", f"pass:{self.certificate_password}"
            ]
            self.run_command.run_command(convert_command, namespace='takserver-installer')

            # Copy the certificate to the system certificates directory
            copy_command = ["sudo", "cp", pem_cert_path, f"/usr/local/share/ca-certificates/{self.name}.crt"]
            self.run_command.run_command(copy_command, namespace='takserver-installer')

            # Update CA certificates
            update_command = ["sudo", "update-ca-certificates"]
            success = self.run_command.run_command(update_command, namespace='takserver-installer')

            if success:
                self.run_command.emit_log_output("Certificate installed to system CA certificates successfully.", 'takserver-installer')
            else:
                self.run_command.emit_log_output("Failed to install the certificate to system CA certificates.", 'takserver-installer')
        else:
            self.run_command.emit_log_output(f"Unsupported OS for installing {self.name} certificate.", 'takserver-installer')
            raise SystemExit("Unsupported OS")

    def remove_admin_cert_from_keychain(self):
        """
        Removes the {self.name} certificate from the OS certificate store (Windows, macOS, Linux).
        """
        self.run_command.emit_log_output(f"Removing {self.name} certificate from the certificate store...", 'takserver-installer')

        os_type = self.os_detector.detect_os()

        if os_type == 'macos':
            # Remove the certificate from macOS Keychain
            delete_command = ["security", "delete-certificate", "-c", f"{self.name}"]
            self.run_command.run_command_no_output(delete_command, namespace='takserver-installer')
            self.run_command.emit_log_output(f"{self.name} certificate removed from Keychain.", 'takserver-installer')
        elif os_type == 'windows':
            # Remove the certificate from Windows Certificate Store
            delete_command = ["powershell", "-Command", f"(Get-ChildItem -Path Cert:\\CurrentUser\\My | where {{ $_.Subject -match 'CN={self.name}' }}) | Remove-Item"]
            self.run_command.run_command_no_output(delete_command, namespace='takserver-installer')
            self.run_command.emit_log_output(f"{self.name} certificate removed from Windows Certificate Store.", 'takserver-installer')
        elif os_type == 'linux':
            # Remove the certificate from system CA certificates
            remove_command = ["sudo", "rm", f"/usr/local/share/ca-certificates/{self.name}.crt"]
            self.run_command.run_command_no_output(remove_command, namespace='takserver-installer')

            # Update CA certificates
            update_command = ["sudo", "update-ca-certificates", "--fresh"]
            self.run_command.run_command_no_output(update_command, namespace='takserver-installer')

            self.run_command.emit_log_output(f"{self.name} certificate removed from system CA certificates.", 'takserver-installer')
        else:
            self.run_command.emit_log_output(f"Unsupported OS for removing {self.name} certificate.", 'takserver-installer')
            raise SystemExit("Unsupported OS")
