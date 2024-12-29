from backend.routes.socketio import socketio
from backend.services.helpers.run_command import RunCommand
import eventlet
import re
import psutil
import time
import os
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
        print("Getting IP address...")
        try:
            # Get the host's IP address using the socket module
            host_ip = socket.gethostbyname(socket.gethostname())
            print(f"Host IP address: {host_ip}")
            return host_ip
        except Exception as e:
            print(f"Error getting IP address: {str(e)}")
            return None

    def get_network_usage(self):
        print("Getting network usage...")
        try:
            # Get current IO counters
            io_counters = psutil.net_io_counters()
            print(f"Current IO counters: {io_counters}")
            
            # Calculate time difference
            current_time = time.time()
            time_diff = current_time - self.last_check_time
            print(f"Time difference: {time_diff} seconds")
            
            # Calculate network usage
            upload = (io_counters.bytes_sent - self.last_io_counters.bytes_sent) / time_diff
            download = (io_counters.bytes_recv - self.last_io_counters.bytes_recv) / time_diff
            total = upload + download
            print(f"Upload: {upload} bytes/sec")
            print(f"Download: {download} bytes/sec")
            print(f"Total: {total} bytes/sec")
            
            # Update last IO counters and check time
            self.last_io_counters = io_counters
            self.last_check_time = current_time
            
            return {
                'upload': round(upload, 2),
                'download': round(download, 2),
                'total': round(total, 2)
            }
        except Exception as e:
            print(f"Error getting network usage: {str(e)}")
            return {
                'upload': 0,
                'download': 0,
                'total': 0
            }

    def get_metrics(self):
        print("Getting metrics...")
        ip_address = self.get_ip_address()
        network_usage = self.get_network_usage()
        print(f"IP address: {ip_address}")
        print(f"Network usage: {network_usage}")
        return {
            'ip_address': ip_address,
            'network': network_usage
        }

    def monitor_ip(self):
        print("Starting IP monitoring...")
        self.monitoring = True
        while self.monitoring:
            try:
                metrics = self.get_metrics()
                print(f"Metrics: {metrics}")
                socketio.emit('network_metrics', metrics, namespace='/ip-fetcher')
                eventlet.sleep(2)
            except Exception as e:
                print(f"Error in IP monitoring: {str(e)}")
                eventlet.sleep(2)

    def stop_monitoring(self):
        print("Stopping IP monitoring...")
        self.monitoring = False

if __name__ == '__main__':
    ip_fetcher = IPFetcher()
    metrics = ip_fetcher.get_metrics()
    print(f"Final metrics: {metrics}")
