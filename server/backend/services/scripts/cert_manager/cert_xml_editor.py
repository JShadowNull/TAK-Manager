import os
from lxml import etree
from typing import Dict, Any, Optional, Tuple

class CertConfigManager:
    def __init__(self):
        self.home_dir = "/home/tak-manager"
        self.working_dir = os.path.join(self.home_dir, "takserver")

    def _initialize_paths(self):
        """Initialize paths that require version detection"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not detect TAK Server version. Ensure version.txt exists and is not empty.")
            
        path_version = self._get_path_version(version)
        if not path_version:
            raise Exception(f"Invalid version format: {version}")
            
        self.tak_path = os.path.join(self.working_dir, "takserver-" + path_version, "tak")
        self.config_path = os.path.join(self.tak_path, "UserAuthenticationFile.xml")
        self.schema_path = os.path.join(self.tak_path, "UserAuthenticationFile.xsd")
        self.namespace = {"ns": "http://bbn.com/marti/xml/bindings"}

    def get_takserver_version(self):
        """Get TAK Server version from version.txt."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    if not version:
                        return None
                    return version
            except Exception:
                return None
        return None
    
    def _get_path_version(self, version):
        """Convert version string for path use."""
        if not version:
            return None
        parts = version.split('-')
        if len(parts) >= 3:
            return f"{parts[0]}-RELEASE-{parts[2]}"
        return version

    def read_cert_config(self, identifier: str) -> str:
        """Read the configuration for a specific certificate"""
        self._initialize_paths()  # Initialize paths before operation
        try:
            parser = etree.XMLParser(remove_blank_text=True)
            tree = etree.parse(self.config_path, parser)
            root = tree.getroot()
            
            # Find the user element with matching identifier
            user_elem = root.find(f".//ns:User[@identifier='{identifier}']", self.namespace)
            
            if user_elem is None:
                raise Exception(f"Certificate with identifier {identifier} not found")
            
            # Convert element to string
            return etree.tostring(user_elem, encoding='unicode', pretty_print=True)
        except Exception as e:
            raise Exception(f"Error reading certificate configuration: {str(e)}")

    def validate_cert_config(self, config: str, identifier: str) -> Tuple[bool, str]:
        """Validate certificate configuration XML against schema by validating the entire file with changes"""
        self._initialize_paths()  # Initialize paths before operation
        try:
            # Load and parse schema
            schema_doc = etree.parse(self.schema_path)
            schema = etree.XMLSchema(schema_doc)
            
            # Parse the main config file with the schema namespace
            parser = etree.XMLParser(remove_blank_text=True, schema=schema)
            tree = etree.parse(self.config_path, parser)
            root = tree.getroot()
            
            # Find the user element to update
            user_elem = root.find(f".//ns:User[@identifier='{identifier}']", self.namespace)
            if user_elem is None:
                return False, f"Certificate with identifier {identifier} not found"
            
            try:
                # Parse the new certificate config
                new_elem = etree.fromstring(config)
            except etree.XMLSyntaxError as e:
                return False, f"Invalid XML format in new configuration: {str(e)}"
            
            # Create a copy of the tree for validation
            validation_tree = etree.ElementTree(root)
            validation_root = validation_tree.getroot()
            
            # Find and replace the user element in the validation tree
            validation_user = validation_root.find(f".//ns:User[@identifier='{identifier}']", self.namespace)
            if validation_user is None:
                return False, "Invalid XML structure"
            
            # Replace the old element with the new one
            parent = validation_user.getparent()
            if parent is None:
                return False, "Invalid XML structure"
            
            parent.replace(validation_user, new_elem)
            
            try:
                # Validate against schema
                schema.assertValid(validation_tree)
                return True, ""
            except etree.DocumentInvalid as e:
                return False, str(e)
            
        except etree.XMLSyntaxError as e:
            return False, f"XML Syntax Error: {str(e)}"
        except Exception as e:
            return False, str(e)

    def update_cert_config(self, identifier: str, new_config: str) -> bool:
        """Update the configuration for a specific certificate"""
        self._initialize_paths()  # Initialize paths before operation
        try:
            # Validate first with the complete file context
            is_valid, error_msg = self.validate_cert_config(new_config, identifier)
            if not is_valid:
                raise Exception(f"Invalid configuration: {error_msg}")
            
            # Parse the main config file
            parser = etree.XMLParser(remove_blank_text=True)
            tree = etree.parse(self.config_path, parser)
            root = tree.getroot()
            
            # Find the user element to update
            user_elem = root.find(f".//ns:User[@identifier='{identifier}']", self.namespace)
            if user_elem is None:
                raise Exception(f"Certificate with identifier {identifier} not found")
            
            # Parse the new configuration
            new_elem = etree.fromstring(new_config)
            
            # Ensure the identifier hasn't been changed
            if new_elem.get('identifier') != identifier:
                raise Exception("Certificate identifier cannot be changed")
            
            # Replace the old element with the new one
            parent = user_elem.getparent()
            if parent is None:
                raise Exception("Invalid XML structure")
            
            parent.replace(user_elem, new_elem)
            
            # Write the updated configuration
            tree.write(self.config_path, encoding='UTF-8', xml_declaration=True, pretty_print=True)
            return True
            
        except Exception as e:
            raise Exception(f"Error updating certificate configuration: {str(e)}") 