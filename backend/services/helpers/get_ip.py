from backend.services.helpers.os_detector import OSDetector
from backend.routes.socketio import socketio
from backend.services.helpers.run_command import RunCommand
import eventlet
import re
import psutil
import time

class IPFetcher:
    def __init__(self):
        self.os_detector = OSDetector()
        self.run_command = RunCommand()
        self.monitoring = False
        self.last_io_counters = psutil.net_io_counters()
        self.last_check_time = time.time()

    def get_network_usage(self):
        """
        Calculate current network usage in MB/s
        """
        try:
            current_time = time.time()
            current_io_counters = psutil.net_io_counters()
            time_elapsed = current_time - self.last_check_time

            # Calculate bytes per second
            bytes_sent = (current_io_counters.bytes_sent - self.last_io_counters.bytes_sent) / time_elapsed
            bytes_recv = (current_io_counters.bytes_recv - self.last_io_counters.bytes_recv) / time_elapsed

            # Convert to MB/s
            mb_sent = bytes_sent / (1024 * 1024)
            mb_recv = bytes_recv / (1024 * 1024)

            # Update last values
            self.last_io_counters = current_io_counters
            self.last_check_time = current_time

            return {
                'upload': round(mb_sent, 2),
                'download': round(mb_recv, 2),
                'total': round(mb_sent + mb_recv, 2)
            }
        except Exception as e:
            print(f"Error getting network usage: {e}")
            return {'upload': 0, 'download': 0, 'total': 0}

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

        result = self.run_command.run_command(command, 'ip-fetcher', capture_output=True, emit_output=False)
        
        if result.returncode == 0:
            if os_type == 'windows':
                match = re.search(r'IPv4 Address[. ]*: ([\d.]+)', result.stdout)
            elif os_type == 'macos':
                match = re.search(r'utun\d:.*?inet (\d+\.\d+\.\d+\.\d+)', result.stdout, re.DOTALL)
                if not match:
                    match = re.search(r'en0:.*?inet (\d+\.\d+\.\d+\.\d+)', result.stdout, re.DOTALL)
            else:
                match = re.search(r'inet ([\d.]+)', result.stdout)
            
            ip_address = match.group(1) if match else 'Unavailable'
            return ip_address if ip_address else 'Unavailable'
        else:
            return 'Unavailable'

    def get_metrics(self):
        """
        Get both IP and network metrics
        """
        return {
            'ip_address': self.get_ip_address(),
            'network': self.get_network_usage()
        }

    def monitor_ip(self):
        """Monitor and emit IP address and network usage updates"""
        self.monitoring = True
        while self.monitoring:
            try:
                metrics = self.get_metrics()
                socketio.emit('network_metrics', metrics, namespace='/ip-fetcher')
                eventlet.sleep(2)
            except Exception as e:
                print(f"Error in monitor_ip: {e}")
                eventlet.sleep(2)

    def stop_monitoring(self):
        """Stop the IP monitoring"""
        self.monitoring = False
