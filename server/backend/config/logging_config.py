import os
import sys
import logging

def get_default_level():
    """Get the default log level based on mode"""
    return logging.DEBUG if os.getenv('MODE') == 'development' else logging.INFO

def configure_logging(name, level=None):
    """Simple logging configuration that outputs to both file and console.
    
    Args:
        name: Logger name (usually __name__ from the calling module)
        level: Optional log level to override the default from mode
    """
    # Use absolute path for logs in Docker
    logs_dir = '/app/logs'
    os.makedirs(logs_dir, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level if level is not None else get_default_level())
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
        
    # Create formatters
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # File handler
    file_handler = logging.FileHandler(os.path.join(logs_dir, 'app.log'))
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger 