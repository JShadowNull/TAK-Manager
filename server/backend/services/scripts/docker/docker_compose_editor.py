import os
import yaml
from typing import Dict, Any, List, Optional
from backend.services.helpers.directories import DirectoryHelper
from backend.services.helpers.run_command import RunCommand
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class DockerComposeEditor:
    """Class to edit docker-compose.yml files for TAK Server."""
    
    @staticmethod
    def get_docker_compose_file_path() -> str:
        """Get the path to the docker-compose.yml file."""
        docker_compose_dir = DirectoryHelper.get_docker_compose_directory()
        return os.path.join(docker_compose_dir, "docker-compose.yml")
    
    @staticmethod
    def read_docker_compose_file() -> Dict[str, Any]:
        """Read the docker-compose.yml file and return its contents as a dictionary."""
        file_path = DockerComposeEditor.get_docker_compose_file_path()
        
        if not os.path.exists(file_path):
            logger.error(f"Docker compose file not found at {file_path}")
            raise FileNotFoundError(f"Docker compose file not found at {file_path}")
        
        try:
            with open(file_path, 'r') as file:
                return yaml.safe_load(file)
        except Exception as e:
            logger.error(f"Error reading docker-compose file: {str(e)}")
            raise
    
    @staticmethod
    def write_docker_compose_file(data: Dict[str, Any]) -> None:
        """Write the docker-compose.yml file with the provided data."""
        file_path = DockerComposeEditor.get_docker_compose_file_path()
        
        try:
            with open(file_path, 'w') as file:
                yaml.dump(data, file, default_flow_style=False, sort_keys=False)
            logger.info(f"Docker compose file updated at {file_path}")
        except Exception as e:
            logger.error(f"Error writing docker-compose file: {str(e)}")
            raise
    
    @staticmethod
    def add_port_to_takserver(host_port: int, container_port: Optional[int] = None) -> Dict[str, Any]:
        """
        Add a port mapping to the takserver service in the docker-compose.yml file.
        
        Args:
            host_port: The port on the host machine
            container_port: The port in the container (defaults to same as host_port if not provided)
            
        Returns:
            The updated docker-compose data
        """
        if container_port is None:
            container_port = host_port
            
        # Read the current docker-compose file
        docker_compose_data = DockerComposeEditor.read_docker_compose_file()
        
        # Check if takserver service exists
        if 'services' not in docker_compose_data or 'takserver' not in docker_compose_data['services']:
            logger.error("Takserver service not found in docker-compose file")
            raise ValueError("Takserver service not found in docker-compose file")
        
        # Get the takserver service
        takserver_service = docker_compose_data['services']['takserver']
        
        # Check if ports section exists
        if 'ports' not in takserver_service:
            takserver_service['ports'] = []
        
        # Check if the port is already mapped
        port_mapping = f"{host_port}:{container_port}"
        if port_mapping in takserver_service['ports']:
            logger.info(f"Port mapping {port_mapping} already exists")
            return docker_compose_data
        
        # Add the new port mapping
        takserver_service['ports'].append(port_mapping)
        logger.info(f"Added port mapping {port_mapping} to takserver service")
        
        # Write the updated docker-compose file
        DockerComposeEditor.write_docker_compose_file(docker_compose_data)
        
        return docker_compose_data
    
    @staticmethod
    def remove_port_from_takserver(host_port: int, container_port: Optional[int] = None) -> Dict[str, Any]:
        """
        Remove a port mapping from the takserver service in the docker-compose.yml file.
        
        Args:
            host_port: The port on the host machine
            container_port: The port in the container (defaults to same as host_port if not provided)
            
        Returns:
            The updated docker-compose data
        """
        if container_port is None:
            container_port = host_port
            
        # Read the current docker-compose file
        docker_compose_data = DockerComposeEditor.read_docker_compose_file()
        
        # Check if takserver service exists
        if 'services' not in docker_compose_data or 'takserver' not in docker_compose_data['services']:
            logger.error("Takserver service not found in docker-compose file")
            raise ValueError("Takserver service not found in docker-compose file")
        
        # Get the takserver service
        takserver_service = docker_compose_data['services']['takserver']
        
        # Check if ports section exists
        if 'ports' not in takserver_service:
            logger.info("No ports section found in takserver service")
            return docker_compose_data
        
        # Check if the port is mapped
        port_mapping = f"{host_port}:{container_port}"
        if port_mapping not in takserver_service['ports']:
            logger.info(f"Port mapping {port_mapping} not found")
            return docker_compose_data
        
        # Remove the port mapping
        takserver_service['ports'].remove(port_mapping)
        logger.info(f"Removed port mapping {port_mapping} from takserver service")
        
        # Write the updated docker-compose file
        DockerComposeEditor.write_docker_compose_file(docker_compose_data)
        
        return docker_compose_data
    
    @staticmethod
    def get_takserver_port_mappings() -> List[str]:
        """
        Get the current port mappings for the takserver service.
        
        Returns:
            A list of port mappings in the format "host_port:container_port"
        """
        try:
            # Read the current docker-compose file
            docker_compose_data = DockerComposeEditor.read_docker_compose_file()
            
            # Check if takserver service exists
            if 'services' not in docker_compose_data or 'takserver' not in docker_compose_data['services']:
                logger.error("Takserver service not found in docker-compose file")
                raise ValueError("Takserver service not found in docker-compose file")
            
            # Get the takserver service
            takserver_service = docker_compose_data['services']['takserver']
            
            # Check if ports section exists
            if 'ports' not in takserver_service:
                return []
            
            return takserver_service['ports']
        except Exception as e:
            logger.error(f"Error getting takserver port mappings: {str(e)}")
            raise 