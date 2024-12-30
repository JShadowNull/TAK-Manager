from backend.routes.socketio import socketio
from backend.services.helpers.run_command import RunCommand
import eventlet
import psutil
import time
import socket

class IPFetcher:
    def __init__(self):
        self.run_command = RunCommand()
        self.monitoring = False
        # Set psutil to use host proc
        psutil.PROCFS_PATH = '/host/proc'
        self.last_io_counters = psutil.net_io_counters()
        self.last_check_time = time.time()

    def get_ip_address(self):
        try:
            host_ip = socket.gethostbyname(socket.gethostname())
            return host_ip
        except Exception as e:
            return None

    def get_network_usage(self):
        try:
            io_counters = psutil.net_io_counters()
            current_time = time.time()
            time_diff = current_time - self.last_check_time
            
            upload = (io_counters.bytes_sent - self.last_io_counters.bytes_sent) / time_diff
            download = (io_counters.bytes_recv - self.last_io_counters.bytes_recv) / time_diff
            total = upload + download
            
            self.last_io_counters = io_counters
            self.last_check_time = current_time
            
            return {
                'upload': round(upload, 2),
                'download': round(download, 2),
                'total': round(total, 2)
            }
        except Exception as e:
            return {
                'upload': 0,
                'download': 0,
                'total': 0
            }

    def get_metrics(self):
        ip_address = self.get_ip_address()
        network_usage = self.get_network_usage()
        return {
            'ip_address': ip_address,
            'network': network_usage
        }

    def monitor_ip(self):
        self.monitoring = True
        while self.monitoring:
            try:
                metrics = self.get_metrics()
                socketio.emit('network_metrics', metrics, namespace='/ip-fetcher')
                eventlet.sleep(2)
            except Exception as e:
                eventlet.sleep(2)

    def stop_monitoring(self):
        self.monitoring = False

if __name__ == '__main__':
    ip_fetcher = IPFetcher()
    metrics = ip_fetcher.get_metrics()
