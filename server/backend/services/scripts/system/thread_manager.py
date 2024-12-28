# File path: backend/services/thread_manager.py
import atexit
from eventlet.greenthread import GreenThread
import eventlet

class ThreadManager:
    def __init__(self):
        self.threads = []
        atexit.register(self.cleanup_threads)

    def add_thread(self, thread):
        """Add a thread to be managed."""
        self.threads.append(thread)

    def spawn(self, func, *args, **kwargs):
        """Spawn a new green thread."""
        thread = eventlet.spawn(func, *args, **kwargs)
        self.add_thread(thread)
        return thread

    def cleanup_threads(self):
        """Clean up all threads."""
        for thread in self.threads:
            try:
                if isinstance(thread, GreenThread):
                    thread.kill()
                elif hasattr(thread, 'is_alive') and thread.is_alive():
                    thread.join(timeout=5)
            except Exception as e:
                print(f"Error cleaning up thread: {e}")

# Global thread manager instance
thread_manager = ThreadManager()
