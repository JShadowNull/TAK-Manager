# backend/services/scripts/takserver/takserver_installer.py

import os
import shutil
from backend.services.helpers.run_command import RunCommand
import re
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.takserver.certconfig import CertConfig
import time
from typing import Dict, Any, Optional, Callable
import asyncio
import docker
import xml.etree.ElementTree as ET
from backend.services.helpers.directories import DirectoryHelper
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

# Load environment variables from .env file

class TakServerInstaller:
    def __init__(
        self,
        docker_zip_path: str,
        postgres_password: str,
        certificate_password: str,
        organization: str,
        state: str,
        city: str,
        organizational_unit: str,
        name: str,
        emit_event: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.docker_client = docker.from_env()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.docker_zip_path = docker_zip_path
        self.postgres_password = postgres_password
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.organizational_unit = organizational_unit
        self.name = name
        self.extracted_folder_name = None
        self.takserver_version = None
        self.emit_event = emit_event
        self.tak_server_status = TakServerStatus()

        self.cert_config = CertConfig(
            certificate_password=self.certificate_password,
            organization=self.organization,
            state=self.state,
            city=self.city,
            organizational_unit=self.organizational_unit,
            name=self.name,
            tak_dir=None,
            emit_event=self.emit_event
        )

    async def update_status(self, status: str, progress: float, message: Optional[str] = None, error: Optional[str] = None) -> None:
        """Update installation status."""
        if self.emit_event:
            # Send terminal message
            await self.emit_event({
                "type": "terminal",
                "message": message,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })
            
            # Send progress update
            await self.emit_event({
                "type": "status",
                "status": status,
                "progress": progress,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })

    async def create_working_directory(self) -> None:
        """Create the working directory."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "📂 Creating working directory...",
                "isError": False
            })
        try:
            self.directory_helper.ensure_clean_directory(self.working_dir)
            self.cert_config.update_working_dir(self.working_dir)
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"✅ Working directory created at {self.working_dir}",
                    "isError": False
                })
        except Exception as e:
            logger.error(f"Error creating working directory: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error creating working directory: {str(e)}",
                    "isError": True
                })
            raise

    async def unzip_docker_release(self) -> None:
        """Extract the TAK Server Docker release."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n📦 Extracting TAK Server package...",
                "isError": False
            })
        try:
            if not os.path.exists(self.docker_zip_path):
                error_msg = f"ZIP file not found at {self.docker_zip_path}"
                logger.error(error_msg)  # Added error log
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": f"\n❌ {error_msg}",
                        "isError": True
                    })
                raise FileNotFoundError(error_msg)

            # Prepare temp directory
            temp_extract_dir = self.directory_helper.get_temp_extract_directory()
            self.directory_helper.ensure_clean_directory(temp_extract_dir)

            # Extract to temp directory
            unzip_command = f"unzip {self.docker_zip_path} -d {temp_extract_dir}"
            result = await self.run_command.run_command_async(
                unzip_command,
                'install',
                emit_event=self.emit_event,
                shell=True
            )
            if not result.success:
                logger.error(f"Unzip command failed: {result.stderr}")  # Added error log
                raise Exception(result.stderr)

            # Find the tak directory in the extracted contents
            extracted_contents = os.listdir(temp_extract_dir)
            if not extracted_contents:
                error_msg = "Zip file appears to be empty"
                logger.error(error_msg)  # Added error log
                raise ValueError(error_msg)

            # Get the first directory
            temp_extracted_folder = os.path.join(temp_extract_dir, extracted_contents[0])
            
            # If it's a directory and contains a nested directory with same name (ignoring case)
            if os.path.isdir(temp_extracted_folder):
                inner_contents = os.listdir(temp_extracted_folder)
                if len(inner_contents) == 1 and inner_contents[0].lower().startswith('takserver-docker'):
                    # Move all contents from nested directory up one level
                    inner_dir = os.path.join(temp_extracted_folder, inner_contents[0])
                    for item in os.listdir(inner_dir):
                        src = os.path.join(inner_dir, item)
                        dst = os.path.join(temp_extracted_folder, item)
                        shutil.move(src, dst)
                    os.rmdir(inner_dir)  # Remove empty nested directory

            # Verify tak directory exists
            if not os.path.exists(os.path.join(temp_extracted_folder, "tak")):
                error_msg = f"TAK directory not found in extracted contents"
                logger.error(error_msg)  # Added error log
                raise ValueError(error_msg)

            # Get version from the extracted files
            version_file = os.path.join(temp_extracted_folder, "tak", "version.txt")
            if not os.path.exists(version_file):
                error_msg = f"Version file not found at {version_file}"
                logger.error(error_msg)  # Added error log
                raise ValueError(error_msg)
            
            with open(version_file, "r") as f:
                version = f.read().strip().lower()
                if not version:
                    error_msg = "Version file is empty"
                    logger.error(error_msg)  # Added error log
                    raise ValueError(error_msg)
                self.takserver_version = version

            # Write version to working directory first
            version_file_path = self.directory_helper.get_version_file_path()
            with open(version_file_path, "w") as version_file:
                version_file.write(f"{self.takserver_version}\n")

            # Create the standardized folder name and paths
            self.extracted_folder_name = f"takserver-docker-{self.takserver_version}"
            final_path = os.path.join(self.working_dir, self.extracted_folder_name)

            # Ensure clean target directory
            self.directory_helper.ensure_clean_directory(final_path)

            # Move the contents to the final location
            for item in os.listdir(temp_extracted_folder):
                src = os.path.join(temp_extracted_folder, item)
                dst = os.path.join(final_path, item)
                shutil.move(src, dst)

            # Set the final tak_dir path
            self.tak_dir = os.path.join(final_path, "tak")
            self.cert_config.update_tak_dir(self.tak_dir)
            
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "🔍 Verifying extracted contents...",
                    "isError": False
                })
            
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"🚚 Moving files to final location: {final_path}",
                    "isError": False
                })

            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"✅ Successfully extracted TAK Server {self.takserver_version}",
                    "isError": False
                })
                
        except Exception as e:
            logger.error(f"Extraction failed: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Extraction failed: {str(e)}",
                    "isError": True
                })
            self.directory_helper.cleanup_temp_directory()
            raise
        finally:
            self.directory_helper.cleanup_temp_directory()

    async def copy_coreconfig(self) -> None:
        """Copy CoreConfig.xml from example."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n🛠️ Copying Coreconfig.example to CoreConfig.xml...",
                "isError": False
            })
        try:
            core_config_path, example_core_config = self.directory_helper.get_core_config_paths(self.tak_dir)

            if not os.path.exists(core_config_path):
                if os.path.exists(example_core_config):
                    shutil.copy(example_core_config, core_config_path)
                else:
                    error_msg = f"Example CoreConfig file not found at {example_core_config}"
                    logger.error(error_msg)  # Added error log
                    raise FileNotFoundError(error_msg)
                
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ CoreConfig.xml copied from Coreconfig.example",
                    "isError": False
                })
        except Exception as e:
            logger.error(f"CoreConfig copy failed: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ CoreConfig copy failed: {str(e)}",
                    "isError": True
                })
            raise

    async def update_coreconfig_password(self) -> None:
        """Update database password in CoreConfig.xml."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n🔑 Updating database credentials...",
                "isError": False
            })
        try:
            core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")

            if os.path.exists(core_config_path):
                # Parse XML with namespaces
                ET.register_namespace('', "http://bbn.com/marti/xml/config")
                ET.register_namespace('xsi', "http://www.w3.org/2001/XMLSchema-instance")
                tree = ET.parse(core_config_path)
                root = tree.getroot()

                # Define namespace map
                ns = {'ns': "http://bbn.com/marti/xml/config"}

                # Find and update repository connection password using namespace
                repository = root.find(".//ns:repository", namespaces=ns)
                if repository is not None:
                    connection = repository.find("ns:connection", namespaces=ns)
                    if connection is not None:
                        connection.set('password', self.postgres_password)
                    else:
                        error_msg = "Repository connection element not found"
                        logger.error(error_msg)  # Added error log
                        raise Exception(error_msg)
                else:
                    error_msg = "Repository element not found"
                    logger.error(error_msg)  # Added error log
                    raise Exception(error_msg)

                # Write back to file
                tree.write(core_config_path, encoding='UTF-8', xml_declaration=True)

                # Format XML using xmllint
                format_result = await self.run_command.run_command_async(
                    f"xmllint --format {core_config_path} -o {core_config_path}",
                    'install',
                    emit_event=self.emit_event,
                    shell=True
                )
                if not format_result.success:
                    error_msg = format_result.stderr
                    logger.error(f"xmllint formatting failed: {error_msg}")  # Added error log
                    raise Exception(error_msg)
            else:
                error_msg = f"CoreConfig.xml not found at {core_config_path}"
                logger.error(error_msg)  # Added error log
                raise FileNotFoundError(error_msg)
                
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ Database password updated successfully",
                    "isError": False
                })
        except Exception as e:
            logger.error(f"Password update failed: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Password update failed: {str(e)}",
                    "isError": True
                })
            raise

    async def modify_coreconfig_with_sed_on_host(self) -> None:
        """Update database host and certificate config in CoreConfig.xml."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "\n⚙️ Configuring database and certificates...",
                "isError": False
            })
        try:
            core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")
            if not os.path.exists(core_config_path):
                error_msg = f"CoreConfig.xml not found at {core_config_path}"
                logger.error(error_msg)  # Added error log
                raise FileNotFoundError(error_msg)

            # Parse XML
            ET.register_namespace('', "http://bbn.com/marti/xml/config")
            ET.register_namespace('xsi', "http://www.w3.org/2001/XMLSchema-instance")
            tree = ET.parse(core_config_path)
            root = tree.getroot()

            # Update database host
            for conn in root.findall(".//connection"):
                url = conn.get('url', '')
                if 'jdbc:postgresql://' in url:
                    new_url = url.replace('localhost', 'tak-database')
                    conn.set('url', new_url)

            # Create certificate signing element
            cert_signing = ET.Element('certificateSigning')
            cert_signing.set('CA', 'TAKServer')

            cert_config = ET.SubElement(cert_signing, 'certificateConfig')
            name_entries = ET.SubElement(cert_config, 'nameEntries')
            
            org_entry = ET.SubElement(name_entries, 'nameEntry')
            org_entry.set('name', 'O')
            org_entry.set('value', 'TAK')
            
            ou_entry = ET.SubElement(name_entries, 'nameEntry')
            ou_entry.set('name', 'OU')
            ou_entry.set('value', 'TAK')

            ca_config = ET.SubElement(cert_signing, 'TAKServerCAConfig')
            ca_config.set('keystore', 'JKS')
            ca_config.set('keystoreFile', 'certs/files/intermediate-signing.jks')
            ca_config.set('keystorePass', self.certificate_password)
            ca_config.set('validityDays', '30')
            ca_config.set('signatureAlg', 'SHA256WithRSA')

            # Create security element
            security = ET.Element('security')
            tls = ET.SubElement(security, 'tls')
            tls.set('keystore', 'JKS')
            tls.set('keystoreFile', 'certs/files/takserver.jks')
            tls.set('keystorePass', self.certificate_password)
            tls.set('truststore', 'JKS')
            tls.set('truststoreFile', 'certs/files/truststore-intermediate.jks')
            tls.set('truststorePass', self.certificate_password)
            tls.set('context', 'TLSv1.2')
            tls.set('keymanager', 'SunX509')

            # Remove existing security section and add new ones
            for old_security in root.findall('.//security'):
                root.remove(old_security)
            root.append(cert_signing)
            root.append(security)

            # Write back to file
            tree.write(core_config_path, encoding='UTF-8', xml_declaration=True)

            # Format XML using xmllint
            format_result = await self.run_command.run_command_async(
                f"xmllint --format {core_config_path} -o {core_config_path}",
                'install',
                emit_event=self.emit_event,
                shell=True
            )
            if not format_result.success:
                error_msg = format_result.stderr
                logger.error(f"xmllint formatting failed: {error_msg}")  # Added error log
                raise Exception(error_msg)
            
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ CoreConfig modifications complete",
                    "isError": False
                })
        except Exception as e:
            logger.error(f"CoreConfig modification failed: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ CoreConfig modification failed: {str(e)}",
                    "isError": True
                })
            raise

    async def create_env_file(self) -> None:
        """Create Docker Compose .env file."""
        if self.emit_event:
            await self.emit_event({
                "type": "terminal",
                "message": "📄 Generating environment configuration...",
                "isError": False
            })
        try:
            env_path = os.path.join(self.working_dir, self.extracted_folder_name, ".env")
            
            # Get base directory from environment, with fallback
            host_base_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
            if not host_base_dir:
                error_msg = "TAK_SERVER_INSTALL_DIR environment variable is not set"
                logger.error(error_msg)  # Added error log
                raise ValueError(error_msg)
                
            host_tak_dir = os.path.join(host_base_dir, 'tak-manager', 'data', 'takserver', self.extracted_folder_name, "tak")
            host_plugins_dir = os.path.join(host_tak_dir, "webcontent")
            
            env_content = f"""TAK_DIR={host_tak_dir}
PLUGINS_DIR={host_plugins_dir}
"""
            with open(env_path, "w") as file:
                file.write(env_content)
                
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ Environment file setup complete",
                    "isError": False
                })
        except Exception as e:
            logger.error(f"Env file creation failed: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Env file creation failed: {str(e)}",
                    "isError": True
                })
            raise

    async def create_docker_compose_file(self) -> None:
        """Create Docker Compose file."""
        try:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n📄 Creating Docker Compose file...",
                    "isError": False
                })
            docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
            
            host_base_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
            host_tak_dir = os.path.join(host_base_dir, 'tak-manager', 'data', 'takserver', self.extracted_folder_name, "tak")
            host_plugins_dir = os.path.join(host_tak_dir, "webcontent")
            
            # Convert paths to Docker format by detecting Windows-style paths
            def convert_path_for_docker(path):
                # Convert to forward slashes for consistency
                path = path.replace('\\', '/')
                
                # Detect Windows path by checking for drive letter pattern (e.g., C:/)
                if re.match(r'^[A-Za-z]:', path):
                    # Convert Windows drive letter (e.g., C:) to Docker format (/c)
                    drive, rest = path.split(':', 1)
                    path = f'/{drive.lower()}{rest}'
                return path
            
            host_tak_dir = convert_path_for_docker(host_tak_dir)
            host_plugins_dir = convert_path_for_docker(host_plugins_dir)
            
            docker_compose_content = f"""
services:
  takserver-db:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver-db
    container_name: tak-database-{self.takserver_version}
    hostname: tak-database
    init: true
    networks:
      - net
    ports:
      - 5432:5432
    restart: unless-stopped
    tty: true
    volumes:
      - type: bind
        source: {host_tak_dir}
        target: /opt/tak
      - db-data:/var/lib/postgresql/data

  takserver:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver
    container_name: takserver-{self.takserver_version}
    hostname: takserver
    init: true
    networks:
      - net
    ports:
      - 8443:8443
      - 8446:8446
      - 8089:8089
      - 8444:8444
    restart: unless-stopped
    tty: true
    volumes:
      - type: bind
        source: {host_tak_dir}
        target: /opt/tak
      - type: bind
        source: {host_plugins_dir}
        target: /opt/tak/webcontent

networks:
  net:
    name: 'takserver'
    ipam:
      driver: default
      config:
        - subnet: 172.16.16.0/24

volumes:
  db-data:
"""
            with open(docker_compose_path, "w") as file:
                file.write(docker_compose_content)
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ Docker Compose file created successfully",
                    "isError": False
                })
            
        except Exception as e:
            logger.error(f"Error creating docker-compose.yml: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error creating docker-compose.yml: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error creating docker-compose.yml: {str(e)}")

    async def start_docker_compose(self) -> None:
        """Start Docker Compose services."""
        try:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n🚀 Starting Docker Compose services...",
                    "isError": False
                })
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            await self.create_env_file()

            _ = await self.run_command.run_command_async(
                ["docker", "compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Build images
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "👷🏼‍♂️ Building TAK Server containers... This may take a few minutes",
                    "isError": False
                })
            build_result = await self.run_command.run_command_async(
                ["docker", "compose", "build"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if not build_result.success:
                logger.error(f"Build command failed: {build_result.stderr}")  # Added error log
                raise Exception(build_result.stderr)

            # Start containers
            up_result = await self.run_command.run_command_async(
                ["docker", "compose", "up", "-d"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ Docker Compose services started successfully",
                    "isError": False
                })
            if not up_result.success:
                logger.error(f"Up command failed: {up_result.stderr}")  # Added error log
                raise Exception(up_result.stderr)

            # Wait for containers to be ready
            max_attempts = 30
            attempt = 0
            containers_ready = False
            
            while attempt < max_attempts and not containers_ready:
                try:
                    # Get container status using Docker SDK
                    db_container = self.docker_client.containers.get(f"tak-database-{self.takserver_version}")
                    server_container = self.docker_client.containers.get(f"takserver-{self.takserver_version}")
                    
                    if db_container.status == "running" and server_container.status == "running":
                        containers_ready = True
                        break
                except docker.errors.NotFound:
                    # Container not found yet, continue waiting
                    pass
                except Exception as e:
                    logger.error(f"Container check error: {str(e)}")  # Added error log
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": f"Container check error: {str(e)}",
                            "isError": False
                        })
                
                attempt += 1
                await asyncio.sleep(1)
            
            if not containers_ready:
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": "❌ Timeout waiting for containers to be ready",
                        "isError": True
                    })
                raise Exception("Timeout waiting for containers to be ready")

        except Exception as e:
            logger.error(f"Error starting Docker containers: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error starting Docker containers: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error starting Docker containers: {str(e)}")

    async def verify_containers(self) -> None:
        """Verify containers are running."""
        try:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n🔍 Verifying container status...",
                    "isError": False
                })
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker", "compose", "ps"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir
            )
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "✅ Containers verified successfully",
                    "isError": False
                })
            if not result.success:
                logger.error(f"Error verifying containers: {result.stderr}")  # Added error log
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": f"❌ Error verifying containers: {result.stderr}",
                        "isError": True
                    })
                raise Exception(result)
            
        except Exception as e:
            logger.error(f"Error verifying containers: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error verifying containers: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error verifying containers: {str(e)}")


    async def restart_takserver(self, container_name: str = None) -> None:
        """Restart TAK Server containers."""
        try:
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n🔄 Restarting TAK Server containers...",
                    "isError": False
                })
            await self.tak_server_status.restart_containers()
        except Exception as e:
            logger.error(f"Error restarting TAK Server: {str(e)}")  # Added error log
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": f"❌ Error restarting TAK Server: {str(e)}",
                    "isError": True
                })
            raise Exception(f"Error restarting TAK Server: {str(e)}")

    async def main(self) -> bool:
        """Main installation method."""
        try:
            # Define task weights and initial progress
            weights = {
                'setup': 5,
                'config': 10,
                'docker_build': 50,
                'docker_start': 15,
                'cert_config': 20
            }
            progress = 0
            
            # Initial setup (0-5%)
            await self.update_status("in_progress", progress)
            await self.create_working_directory()
            progress += weights['setup'] * 0.3
            await self.update_status("in_progress", progress)
            await self.unzip_docker_release()
            progress += weights['setup'] * 0.7
            await self.update_status("in_progress", progress)

            # Configuration (5-15%)
            config_steps = [
                self.copy_coreconfig,
                self.update_coreconfig_password,
                self.modify_coreconfig_with_sed_on_host,
                self.create_docker_compose_file
            ]
            for step in config_steps:
                await step()
                progress += weights['config'] / len(config_steps)
                await self.update_status("in_progress", progress)

            # Docker build and deployment (15-80%)
            build_start_progress = progress
            build_weight = weights['docker_build'] + weights['docker_start']
            
            async def simulate_progress():
                nonlocal progress
                while progress < build_start_progress + build_weight:
                    progress = min(progress + 1, build_start_progress + build_weight)
                    await self.update_status("in_progress", progress)
                    await asyncio.sleep(2)
            
            # Start progress simulation and docker operations concurrently
            progress_task = asyncio.create_task(simulate_progress())
            await self.start_docker_compose()
            progress_task.cancel()
            
            # Finalize docker progress
            progress = build_start_progress + build_weight
            await self.update_status("in_progress", progress)

            # Certificate configuration (80-100%)
            cert_steps = [
                (self.cert_config.configure_cert_metadata, 0.25),
                (self.cert_config.certificate_generation, 0.25),
                (lambda _: self.restart_takserver(), 0.25),
                (self.cert_config.run_certmod, 0.15),
                (self.cert_config.copy_client_cert_to_webaccess, 0.10)
            ]
            for step, weight in cert_steps:
                await step(f"takserver-{self.takserver_version}")
                progress += weights['cert_config'] * weight
                await self.update_status("in_progress", progress)

            await self.update_status("complete", 100)
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n🎉 Installation complete",
                    "isError": False
                })
            return True

        except Exception as e:
            error_message = f"Installation failed: {str(e)}"
            logger.error(error_message)  # Added error log
            await self.update_status("error", 100, error=error_message)
            
            # Run uninstaller to clean up failed installation
            if self.emit_event:
                await self.emit_event({
                    "type": "terminal",
                    "message": "\n🧹 Installation failed. Running cleanup...",
                    "isError": False
                })
            
            try:
                uninstaller = TakServerUninstaller(emit_event=self.emit_event)
                await uninstaller.uninstall()
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": "✅ Cleanup completed successfully",
                        "isError": False
                    })
            except Exception as cleanup_error:
                logger.error(f"Cleanup encountered issues: {str(cleanup_error)}")  # Added error log
                if self.emit_event:
                    await self.emit_event({
                        "type": "terminal",
                        "message": f"⚠️ Cleanup encountered issues: {str(cleanup_error)}",
                        "isError": True
                    })
            
            return False

