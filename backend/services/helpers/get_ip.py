from backend.services.helpers.os_detector import OSDetector
from backend.routes.socketio import socketio
from backend.services.helpers.run_command import RunCommand
import eventlet
import re

class IPFetcher:
    def __init__(self):
        self.os_detector = OSDetector()
        self.run_command = RunCommand()
        self.monitoring = False

    def get_ip_address(self):
        """
        Fetches the current active IP address of the machine, including VPN IP if connected.
        """
        os_type = self.os_detector.detect_os()
        
        if os_type == 'macos':
            command = ['ifconfig']
        elif os_type == 'windows':
            command = ['ipconfig']
        elif os_type == 'linux':
            command = ['ip', 'addr', 'show']
        else:
            return 'Unsupported OS'

        result = self.run_command.run_command(command, 'ip-fetcher', capture_output=True)
        
        if result.returncode == 0:
            if os_type == 'windows':
                # Extract the active IP address from the ipconfig output for Windows
                match = re.search(r'IPv4 Address[. ]*: ([\d.]+)', result.stdout)
            elif os_type == 'macos':
                # Extract the active IP address from the ifconfig output for macOS
                # Prioritize VPN IP if available
                match = re.search(r'utun\d:.*?inet (\d+\.\d+\.\d+\.\d+)', result.stdout, re.DOTALL)
                if not match:
                    match = re.search(r'en0:.*?inet (\d+\.\d+\.\d+\.\d+)', result.stdout, re.DOTALL)
            else:
                # Extract the active IP address from the ip output for Linux
                match = re.search(r'inet ([\d.]+)', result.stdout)
            
            ip_address = match.group(1) if match else 'Unavailable'
            return ip_address if ip_address else 'Unavailable'
        else:
            return 'Unavailable'

    def monitor_ip(self):
        """Monitor and emit IP address updates"""
        self.monitoring = True
        while self.monitoring:
            try:
                ip_address = self.get_ip_address()
                print(f"Emitting IP address: {ip_address}")
                socketio.emit('ip_address_update', {'ip_address': ip_address}, namespace='/ip-fetcher')
                eventlet.sleep(2)
            except Exception as e:
                print(f"Error monitoring IP: {e}")
                eventlet.sleep(2)

    def stop_monitoring(self):
        """Stop the IP monitoring"""
        self.monitoring = False
