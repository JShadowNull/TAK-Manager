import os
import sys

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    elif getattr(sys, 'frozen', False):
        # Running in a bundle
        bundle_dir = os.path.dirname(sys.executable)
        return os.path.join(bundle_dir, '..', 'Resources', relative_path)
    else:
        # Running in normal Python environment
        return os.path.join(os.path.dirname(__file__), '..', '..', '..', relative_path) 