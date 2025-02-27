import os
from backend.services.helpers.directories import DirectoryHelper
from backend.config.logging_config import configure_logging
from backend.services.helpers.run_command import RunCommand
from backend.services.scripts.takserver.check_status import TakServerStatus

logger = configure_logging(__name__)

class FixDatabase:
    def __init__(self):
        self.directory_helper = DirectoryHelper()
        self.run_command = RunCommand()
        self.tak_server_status = TakServerStatus()

    def get_core_config_path(self) -> str:
        """Get the path to the CoreConfig.xml file."""
        tak_directory = self.directory_helper.get_tak_directory()
        if tak_directory:
            path = os.path.join(tak_directory, "CoreConfig.xml")
            if not os.path.exists(path):
                logger.error(f"CoreConfig.xml not found at expected path: {path}")
                raise FileNotFoundError(f"CoreConfig.xml not found at expected path: {path}")
            return path
        logger.error("Failed to retrieve TAK directory while getting CoreConfig path")
        raise RuntimeError("Could not determine TAK directory location")
    
    def get_current_db_credentials(self) -> dict:
        """Read database credentials from CoreConfig.xml"""
        try:
            import xml.etree.ElementTree as ET
            
            config_path = self.get_core_config_path()
            tree = ET.parse(config_path)
            root = tree.getroot()
            
            ns = {'ns': 'http://bbn.com/marti/xml/config'}
            connection = root.find('.//ns:repository/ns:connection', ns)
            
            if connection is None:
                logger.error("Missing database connection configuration in CoreConfig.xml")
                raise ValueError("Missing database connection configuration in CoreConfig.xml")
                
            creds = {
                'username': connection.get('username'),
                'password': connection.get('password')
            }
            
            if not all(creds.values()):
                missing = [k for k, v in creds.items() if not v]
                logger.error(f"Empty credentials in CoreConfig.xml for: {', '.join(missing)}")
                raise ValueError(f"Empty credentials in CoreConfig.xml for: {', '.join(missing)}")
                
            return creds
            
        except ET.ParseError as e:
            logger.exception(f"Invalid XML structure in CoreConfig.xml at {config_path}")
            raise RuntimeError(f"Failed to parse CoreConfig.xml: {str(e)}") from e
        except Exception as e:
            logger.exception("Unexpected error reading database credentials")
            raise RuntimeError("Critical error retrieving database credentials") from e

    def get_database_container_name(self) -> str:
        """Get version-specific database container name"""
        try:
            version = self.directory_helper.get_takserver_version()
            if not version:
                logger.error("TAK Server version unavailable")
                raise ValueError("TAK Server version unavailable")
            return f"tak-database-{version}"
        except Exception as e:
            logger.exception("Failed to determine database container name")
            raise RuntimeError("Could not construct database container name") from e

    async def fix_database_password(self):
        """Resets PostgreSQL password for martiuser user in Docker container"""
        try:
            credentials = self.get_current_db_credentials()
            container_name = self.get_database_container_name()
            
            command = [
                'docker', 'exec', container_name,
                'su', '-', 'postgres',
                '-c', 'psql -c "ALTER USER {0} WITH PASSWORD \'{1}\';"'.format(
                    credentials['username'],
                    credentials['password']
                )
            ]

            result = await self.run_command.run_command_async(
                command=command,
                event_type="database_password_reset",
                ignore_errors=False
            )

            if not result.success:
                error_msg = (
                    f"Password reset failed for container {container_name}\n"
                    f"Exit code: {result.returncode}\n"
                    f"Error output: {result.stderr}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            self.database_password = credentials['password']
            logger.info(f"Successfully updated database password in {container_name}")

            # Restart the TAK Server after successful password reset
            await self.tak_server_status.restart_containers()

            return result

        except Exception as e:
            error_msg = f"Database password reset failed: {str(e)}"
            logger.exception(error_msg)
            raise RuntimeError(error_msg) from e
