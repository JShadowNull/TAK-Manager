import xml.etree.ElementTree as ET
import os
from xml.dom import minidom
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class PreferencesManager:
    def __init__(self):
        pass
        
    def generate_config_pref(self, preferences_data, temp_dir):
        """Generates the config.pref file in the temporary directory"""
        try:
            # Create the root element
            preferences = ET.Element('preferences')
            
            # First create the cot_streams preference
            cot_streams = ET.SubElement(preferences, 'preference')
            cot_streams.set('name', 'cot_streams')  # Set attributes individually to control order
            cot_streams.set('version', '1')
            
            # Get the count of CoT streams
            stream_count = int(preferences_data.get('count', 1))
            
            # Add count entry first
            count_entry = ET.SubElement(cot_streams, 'entry')
            count_entry.set('key', 'count')
            count_entry.set('class', 'class java.lang.Integer')
            count_entry.text = str(stream_count)
            
            # Check if enrollment mode is enabled
            enrollment_enabled = preferences_data.get('enrollment', False)
            logger.debug(f"Enrollment mode: {enrollment_enabled}")
            
            # Process each stream's configuration
            for i in range(stream_count):
                # Get stream details with proper error handling
                description = preferences_data.get(f'description{i}', '')
                ip_address = preferences_data.get(f'ipAddress{i}', '')
                port = preferences_data.get(f'port{i}', '')
                protocol = preferences_data.get(f'protocol{i}', '')
                ca_location = preferences_data.get(f'caLocation{i}', '')
                cert_location = preferences_data.get(f'certificateLocation{i}', '')
                client_password = preferences_data.get(f'clientPassword{i}', '')
                ca_password = preferences_data.get(f'caPassword{i}', client_password)  # Use client password as CA password if not specified

                # Log the stream configuration for debugging
                logger.debug(f"Processing stream {i} configuration:")
                logger.debug(f"Description: {description}")
                logger.debug(f"IP Address: {ip_address}")
                logger.debug(f"Port: {port}")
                logger.debug(f"Protocol: {protocol}")
                logger.debug(f"CA Location: {ca_location}")
                logger.debug(f"Client Password: {'*' * len(client_password) if client_password else 'None'}")

                # Add description entry
                desc_entry = ET.SubElement(cot_streams, 'entry')
                desc_entry.set('key', f'description{i}')
                desc_entry.set('class', 'class java.lang.String')
                desc_entry.text = description

                # Add enabled entry (always true for configured streams)
                enabled_entry = ET.SubElement(cot_streams, 'entry')
                enabled_entry.set('key', f'enabled{i}')
                enabled_entry.set('class', 'class java.lang.Boolean')
                enabled_entry.text = 'true'

                # Only add connect string if we have all required parts
                if ip_address and port and protocol:
                    connect_string = f"{ip_address}:{port}:{protocol}"
                    connect_entry = ET.SubElement(cot_streams, 'entry')
                    connect_entry.set('key', f'connectString{i}')
                    connect_entry.set('class', 'class java.lang.String')
                    connect_entry.text = connect_string

                # Add certificate entries if they exist
                if ca_location:
                    ca_entry = ET.SubElement(cot_streams, 'entry')
                    ca_entry.set('key', f'caLocation{i}')
                    ca_entry.set('class', 'class java.lang.String')
                    ca_entry.text = ca_location

                # Handle enrollment differently than regular client cert mode
                if enrollment_enabled:
                    # Add enrollment entries
                    enroll_entry = ET.SubElement(cot_streams, 'entry')
                    enroll_entry.set('key', f'enrollForCertificateWithTrust{i}')
                    enroll_entry.set('class', 'class java.lang.Boolean')
                    enroll_entry.text = 'true'
                    
                    use_auth_entry = ET.SubElement(cot_streams, 'entry')
                    use_auth_entry.set('key', f'useAuth{i}')
                    use_auth_entry.set('class', 'class java.lang.Boolean')
                    use_auth_entry.text = 'true'
                    
                    cache_creds_entry = ET.SubElement(cot_streams, 'entry')
                    cache_creds_entry.set('key', f'cacheCreds{i}')
                    cache_creds_entry.set('class', 'class java.lang.String')
                    cache_creds_entry.text = 'Cache credentials'
                else:
                    # Regular mode - add client certificate if it exists
                    if cert_location:
                        cert_entry = ET.SubElement(cot_streams, 'entry')
                        cert_entry.set('key', f'certificateLocation{i}')
                        cert_entry.set('class', 'class java.lang.String')
                        cert_entry.text = cert_location

                # Add password entries if they exist
                if not enrollment_enabled and client_password:
                    client_pass_entry = ET.SubElement(cot_streams, 'entry')
                    client_pass_entry.set('key', f'clientPassword{i}')
                    client_pass_entry.set('class', 'class java.lang.String')
                    client_pass_entry.text = client_password

                if ca_password:
                    ca_pass_entry = ET.SubElement(cot_streams, 'entry')
                    ca_pass_entry.set('key', f'caPassword{i}')
                    ca_pass_entry.set('class', 'class java.lang.String')
                    ca_pass_entry.text = ca_password

            # Create the main preferences section for ATAK settings
            main_pref = ET.SubElement(preferences, 'preference')
            
            # Use app_preferences instead of civ_preferences since it's more general
            main_pref.set('name', 'com.atakmap.app_preferences')
            main_pref.set('version', '1')
            
            # Process ATAK preferences as direct entries
            for key, value in preferences_data.items():
                # Skip CoT stream related keys and special keys
                if (any(key.startswith(prefix) for prefix in ['description', 'ipAddress', 'port', 'protocol', 
                    'caLocation', 'certificateLocation', 'clientPassword', 'caPassword', 'certPassword', 'count']) or 
                    key.startswith('#') or key == 'enrollment' or key == 'customFiles'):
                    continue

                # Add the preference entry
                entry = ET.SubElement(main_pref, 'entry')
                entry.set('key', key)
                
                # Determine the class type based on the value
                if isinstance(value, bool) or str(value).lower() in ('true', 'false'):
                    entry.set('class', 'class java.lang.Boolean')
                    entry.text = str(value).lower()
                else:
                    # Store all non-boolean values as strings
                    entry.set('class', 'class java.lang.String')
                    entry.text = str(value)
            
            # Convert to string with proper formatting
            rough_string = ET.tostring(preferences, 'utf-8')
            reparsed = minidom.parseString(rough_string)
            
            # Create custom XML declaration and format
            xml_content = '<?xml version="1.0" standalone="yes"?>\n'
            xml_content += '\n'.join([node.toprettyxml(indent="", newl="\n") for node in reparsed.childNodes if node.nodeType == node.ELEMENT_NODE])
            
            # Write to file
            config_pref_path = os.path.join(temp_dir, 'initial.pref')
            with open(config_pref_path, 'w', encoding='utf-8') as file:
                file.write(xml_content)
            
            # Log the generated XML for debugging
            logger.debug(f"Generated XML configuration:\n{xml_content}")
            return config_pref_path
        except Exception as e:
            logger.error(f"Config generation failed: {str(e)}")
            logger.error("Preferences data: %s", preferences_data)  # Log preferences data for debugging
            logger.error("Temporary directory: %s", temp_dir)  # Log temp directory for debugging
            raise Exception(f"Configuration file creation error: {str(e)}")

    def clean_preferences_data(self, preferences_data):
        """Clean special markers from preferences data"""
        return {
            key: value['value'] if isinstance(value, dict) else value
            for key, value in preferences_data.items()
            if not key.startswith('#')
        }

    def extract_certificates(self, preferences_data, stream_count):
        """Extract certificate names from preferences data"""
        ca_certs = []
        client_certs = []

        # Skip client certs in enrollment mode
        enrollment_enabled = preferences_data.get('enrollment', False)
        if enrollment_enabled:
            logger.debug("Enrollment mode enabled - skipping client certificates")
            # Only include CA certificates in enrollment mode
            for i in range(stream_count):
                ca_cert = preferences_data.get(f'caLocation{i}', '').replace('cert/', '')
                if ca_cert and ca_cert not in ca_certs:
                    ca_certs.append(ca_cert)
            return ca_certs, []
        
        # Standard mode - include both CA and client certs
        main_client_cert = preferences_data.get('certificateLocation0', '').replace('cert/', '')
        if main_client_cert:
            client_certs.append(main_client_cert)

        for i in range(stream_count):
            ca_cert = preferences_data.get(f'caLocation{i}', '').replace('cert/', '')
            if ca_cert and ca_cert not in ca_certs:
                ca_certs.append(ca_cert)

            if i > 0:
                client_cert = preferences_data.get(f'certificateLocation{i}', '').replace('cert/', '')
                if client_cert and client_cert not in client_certs:
                    client_certs.append(client_cert)

        return ca_certs, client_certs 