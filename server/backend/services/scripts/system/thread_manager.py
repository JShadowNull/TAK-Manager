# File path: backend/services/thread_manager.py
import threading
import logging
from typing import Any, Callable, Dict
from flask import Flask, current_app
from backend.config.logging_config import configure_logging

logger = configure_logging(__name__)

class ThreadManager:
    def __init__(self):
        self._threads: Dict[str, threading.Thread] = {}
        self._stop_events: Dict[str, threading.Event] = {}
        self._lock = threading.Lock()
        logger.info("ThreadManager initialized")

    def _run_in_context(self, app: Flask, func: Callable, stop_event: threading.Event, *args, **kwargs):
        """Run the function in Flask application context"""
        thread_id = kwargs.get('thread_id', 'unknown')
        logger.debug(f"Starting thread execution for {thread_id}")
        
        try:
            with app.app_context():
                logger.info(f"Thread {thread_id} started")
                while not stop_event.is_set():
                    try:
                        if not func(*args, **kwargs):
                            logger.debug(f"Thread {thread_id} function returned False, breaking loop")
                            break
                    except Exception as e:
                        logger.error(f"Error in thread {thread_id} monitoring task: {str(e)}")
                        break
                logger.info(f"Thread {thread_id} completed normally")
        except Exception as e:
            logger.error(f"Critical error in thread {thread_id}: {str(e)}")

    def spawn(self, func: Callable, thread_id: str, *args, **kwargs):
        """Spawn a new thread with the given function"""
        with self._lock:
            logger.debug(f"Attempting to spawn thread {thread_id}")
            
            if thread_id in self._threads and self._threads[thread_id].is_alive():
                logger.warning(f"Thread {thread_id} is already running")
                return False

            try:
                app = current_app._get_current_object()  # Get the actual Flask app instance
                stop_event = threading.Event()
                thread = threading.Thread(
                    target=self._run_in_context,
                    args=(app, func, stop_event) + args,
                    kwargs={'thread_id': thread_id, **kwargs},
                    daemon=True
                )
                
                self._stop_events[thread_id] = stop_event
                self._threads[thread_id] = thread
                thread.start()
                
                logger.info(f"Successfully spawned thread {thread_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to spawn thread {thread_id}: {str(e)}")
                return False

    def stop_thread(self, thread_id: str) -> bool:
        """Stop a running thread"""
        with self._lock:
            logger.debug(f"Attempting to stop thread {thread_id}")
            
            if thread_id not in self._threads:
                logger.warning(f"Thread {thread_id} not found")
                return False

            try:
                stop_event = self._stop_events.get(thread_id)
                if stop_event:
                    stop_event.set()
                    logger.debug(f"Stop event set for thread {thread_id}")

                thread = self._threads[thread_id]
                if thread.is_alive():
                    thread.join(timeout=5.0)
                    logger.debug(f"Joined thread {thread_id} with timeout")

                del self._threads[thread_id]
                del self._stop_events[thread_id]
                logger.info(f"Successfully stopped thread {thread_id}")
                return True
            except Exception as e:
                logger.error(f"Error stopping thread {thread_id}: {str(e)}")
                return False

    def is_thread_running(self, thread_id: str) -> bool:
        """Check if a thread is running"""
        is_running = thread_id in self._threads and self._threads[thread_id].is_alive()
        logger.debug(f"Thread {thread_id} running status: {is_running}")
        return is_running

    def cleanup_threads(self):
        """Stop all running threads"""
        with self._lock:
            thread_count = len(self._threads)
            logger.info(f"Cleaning up {thread_count} threads")
            thread_ids = list(self._threads.keys())
            for thread_id in thread_ids:
                logger.debug(f"Cleaning up thread {thread_id}")
                self.stop_thread(thread_id)
            logger.info("Thread cleanup completed")

thread_manager = ThreadManager()
