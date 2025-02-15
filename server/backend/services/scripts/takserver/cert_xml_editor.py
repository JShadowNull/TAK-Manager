import os
from lxml import etree
from typing import Dict, Any, Optional, Tuple
import shutil
from datetime import datetime

class CertConfigManager:
    def __init__(self):
        self.tak_path = "/home/tak-manager/takserver-docker/takserver-docker-5.3-RELEASE-24/tak"
        self.config_path = os.path.join(self.tak_path, "UserAuthenticationFile.xml")
        self.schema_path = os.path.join(self.tak_path, "UserAuthenticationFile.xsd")
        self.backups_dir = os.path.join(self.tak_path, "cert_config_backups")
        self.init_backup_path = os.path.join(self.backups_dir, "init_backup.xml")
        self.namespace = {"ns": "http://bbn.com/marti/xml/bindings"}
        
        # Ensure backups directory exists
        if not os.path.exists(self.backups_dir):
            os.makedirs(self.backups_dir)

    def ensure_init_backup(self) -> None:
        """Ensure initial backup exists, create if it doesn't"""
        if not os.path.exists(self.init_backup_path):
            if os.path.exists(self.config_path):
                shutil.copy2(self.config_path, self.init_backup_path)
            else:
                raise Exception("UserAuthenticationFile.xml not found")

    def create_backup(self) -> None:
        """Create a backup of the current configuration"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(self.backups_dir, f"backup_{timestamp}.xml")
        shutil.copy2(self.config_path, backup_path)

    def read_cert_config(self, identifier: str) -> str:
        """Read the configuration for a specific certificate"""
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
        try:
            # Validate first with the complete file context
            is_valid, error_msg = self.validate_cert_config(new_config, identifier)
            if not is_valid:
                raise Exception(f"Invalid configuration: {error_msg}")

            # Create backup before modification
            self.create_backup()
            
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