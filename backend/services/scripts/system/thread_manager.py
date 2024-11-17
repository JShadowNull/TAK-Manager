# File path: backend/services/thread_manager.py
import threading
import atexit
from eventlet.greenthread import GreenThread

class ThreadManager:
    def __init__(self):
        self.threads = []
        atexit.register(self.cleanup_threads)

    def add_thread(self, thread):
        self.threads.append(thread)

    def cleanup_threads(self):
        for thread in self.threads:
            try:
                # Handle both regular threads and eventlet threads
                if isinstance(thread, GreenThread):
                    thread.kill()
                elif isinstance(thread, threading.Thread) and thread.is_alive():
                    thread.join(timeout=5)
            except Exception as e:
                print(f"Error cleaning up thread: {e}")

thread_manager = ThreadManager()
