# server/backend/services/scripts/system/system_monitor.py

import time
import subprocess
import json
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import asyncio
from backend.config.logging_config import configure_logging
import logging

# Setup logging
logger = configure_logging(__name__)
# Set log level to INFO
logger.setLevel(logging.INFO)


class SystemMonitor:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.emit_event = emit_event
        logger.debug("SystemMonitor initialized")

    def get_docker_stats(self) -> Dict[str, Any]:
        """Get Docker container stats"""
        try:
            logger.debug("Fetching Docker container stats")
            cmd = ['docker', 'stats', '--no-stream', '--format', '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}']
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            if not result.stdout.strip():
                logger.warning("No Docker stats output received")
                return {}
                
            metrics = {}
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                    
                name, cpu, mem_usage, mem_perc, net_io = line.split('\t')
                # Extract just the memory usage part (e.g., "269.1MiB" from "269.1MiB / 11.72GiB")
                mem_used = mem_usage.split('/')[0].strip()
                
                # Parse network I/O (e.g., "510kB / 63.9MB")
                net_in, net_out = [x.strip() for x in net_io.split('/')]
                
                metrics[name] = {
                    'cpu_percent': cpu.rstrip('%'),
                    'memory_used': mem_used,
                    'network': {
                        'in': net_in,
                        'out': net_out
                    }
                }
            
            return metrics
            
        except Exception as e:
            logger.warning(f"Failed to get Docker stats: {str(e)}")
            return {}

    def _parse_size_value(self, size_str: str) -> float:
        """Convert size string with units to float value in MB"""
        try:
            # Remove any spaces and convert to uppercase for consistency
            size_str = size_str.strip().upper()
            
            # Extract numeric value and unit
            value = float(''.join(c for c in size_str if c.isdigit() or c == '.'))
            
            # Convert to MB based on unit
            if 'GIB' in size_str or 'GB' in size_str:
                return value * 1024
            elif 'MIB' in size_str or 'MB' in size_str:
                return value
            elif 'KIB' in size_str or 'KB' in size_str:
                return value / 1024
            elif 'B' in size_str:
                return value / (1024 * 1024)
            return value
        except Exception as e:
            logger.error(f"Error parsing size value '{size_str}': {str(e)}")
            return 0.0

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get formatted system metrics"""
        try:
            metrics = self.get_docker_stats()
            if metrics:
                # Calculate totals
                total_cpu = 0
                total_memory_mb = 0
                total_network_in = 0
                total_network_out = 0
                
                for container_name, container_metrics in metrics.items():
                    try:
                        total_cpu += float(container_metrics['cpu_percent'])
                        memory_mb = self._parse_size_value(container_metrics['memory_used'])
                        total_memory_mb += memory_mb
                        net_in = self._parse_size_value(container_metrics['network']['in'])
                        net_out = self._parse_size_value(container_metrics['network']['out'])
                        total_network_in += net_in
                        total_network_out += net_out
                    except Exception as e:
                        logger.error(f"Error processing metrics for container {container_name}: {str(e)}")

                return {
                    'totalCpu': round(total_cpu, 2),
                    'totalMemory': round(total_memory_mb, 2),
                    'network': {
                        'upload': round(total_network_out, 2),
                        'download': round(total_network_in, 2)
                    },
                    'timestamp': time.time()
                }
            return {}
        except Exception as e:
            logger.error(f"Error getting system metrics: {str(e)}")
            return {}

    async def metrics_generator(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate system metrics events."""
        while True:
            try:
                metrics = self.get_system_metrics()
                if metrics:
                    yield {
                        "event": "system-metrics",
                        "data": json.dumps(metrics)
                    }
                    if self.emit_event:
                        self.emit_event(metrics)
            except Exception as e:
                logger.error(f"Error generating metrics: {str(e)}")
                yield {
                    "event": "system-metrics",
                    "data": json.dumps({
                        "error": str(e)
                    })
                }
            await asyncio.sleep(2)  # Update every 5 seconds
