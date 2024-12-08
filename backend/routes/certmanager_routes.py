from flask import Blueprint, request, jsonify
from backend.services.scripts.cert_manager.certmanager import CertManager

certmanager_routes = Blueprint('certmanager_routes', __name__)
cert_manager = CertManager()

def validate_cert_data(cert_data):
    """Validate individual certificate data."""
    if not isinstance(cert_data, dict):
        return False, "Certificate data must be a dictionary"
        
    username = cert_data.get('username')
    if not username:
        return False, "Username is required"
        
    # Allow hyphens and underscores in username
    if not all(c.isalnum() or c in '-_' for c in username):
        return False, "Username must contain only letters, numbers, hyphens, and underscores"
        
    groups = cert_data.get('groups', ['__ANON__'])
    if not isinstance(groups, list):
        return False, "Groups must be a list"
        
    return True, None

@certmanager_routes.route('/create', methods=['POST'])
def create_certificates():
    """Create certificates in either batch or single mode."""
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid request format'
            }), 400

        # Handle batch mode
        if all(key in data for key in ['name', 'count', 'prefixType']):
            base_name = data['name'].strip()
            group = data.get('group', '__ANON__').strip()
            count = int(data['count'])
            prefix_type = data['prefixType']
            is_admin = data.get('isAdmin', False)
            include_group = data.get('includeGroupInName', True)

            # Validate base inputs
            if not base_name:
                return jsonify({
                    'success': False,
                    'message': 'Base name is required'
                }), 400

            if not all(c.isalnum() or c in '-_' for c in base_name):
                return jsonify({
                    'success': False,
                    'message': 'Base name must contain only letters, numbers, hyphens, and underscores'
                }), 400

            if count < 1:
                return jsonify({
                    'success': False,
                    'message': 'Count must be greater than 0'
                }), 400

            certificates = []
            # Generate certificate data based on prefix type
            for i in range(1, count + 1):
                suffix = chr(96 + i) if prefix_type == 'alpha' else str(i)
                username = f"{base_name}-{group}-{suffix}" if include_group else f"{base_name}-{suffix}"
                certificates.append({
                    'username': username,
                    'groups': [group],
                    'is_admin': is_admin
                })

        # Handle single/custom mode
        elif 'certificates' in data:
            certificates = data['certificates']
            if not isinstance(certificates, list) or not certificates:
                return jsonify({
                    'success': False,
                    'message': 'Certificates must be a non-empty list'
                }), 400

        else:
            return jsonify({
                'success': False,
                'message': 'Invalid request format: missing required fields'
            }), 400

        results = []
        success_count = 0
        failure_count = 0

        for cert_data in certificates:
            try:
                # Validate certificate data
                is_valid, error_message = validate_cert_data(cert_data)
                if not is_valid:
                    results.append({
                        'username': cert_data.get('username', 'unknown'),
                        'success': False,
                        'message': error_message
                    })
                    failure_count += 1
                    continue

                # Create certificate with validated data
                result = cert_manager.create_main(
                    username=cert_data['username'],
                    password=cert_data.get('password'),
                    is_admin=cert_data.get('is_admin', False),
                    groups=cert_data.get('groups', ['__ANON__'])
                )

                results.append({
                    'username': cert_data['username'],
                    'success': result['success'],
                    'message': result.get('message', 'Certificate created successfully' if result['success'] else 'Failed to create certificate')
                })

                if result['success']:
                    success_count += 1
                else:
                    failure_count += 1

            except Exception as e:
                results.append({
                    'username': cert_data.get('username', 'unknown'),
                    'success': False,
                    'message': str(e)
                })
                failure_count += 1

        return jsonify({
            'success': failure_count == 0,
            'message': f'Created {success_count} certificates, {failure_count} failures',
            'results': results
        }), 201 if failure_count == 0 else 207

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error in certificate creation: {str(e)}'
        }), 500

@certmanager_routes.route('/delete', methods=['DELETE'])
def delete_certificates():
    """Delete multiple certificates and users."""
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid request format'
            }), 400

        usernames = data.get('usernames', [])
        if not isinstance(usernames, list) or not usernames:
            return jsonify({
                'success': False,
                'message': 'Usernames must be a non-empty list'
            }), 400

        results = []
        success_count = 0
        failure_count = 0

        for username in usernames:
            if not username or not isinstance(username, str):
                results.append({
                    'username': str(username),
                    'success': False,
                    'message': 'Invalid username format'
                })
                failure_count += 1
                continue

            result = cert_manager.delete_main(username=username)
            results.append({
                'username': username,
                'success': result['success'],
                'message': result['message']
            })

            if result['success']:
                success_count += 1
            else:
                failure_count += 1

        return jsonify({
            'success': failure_count == 0,
            'message': f'Deleted {success_count} certificates, {failure_count} failures',
            'results': results
        }), 200 if failure_count == 0 else 207

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error in batch certificate deletion: {str(e)}'
        }), 500