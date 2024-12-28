# backend/services/scripts/os_detector.py

import platform

class OSDetector:
    """
    A class to detect the current operating system.
    """

    def detect_os(self):
        """
        Detects the current operating system and returns it as a string.
        Supported OS types: macOS, Windows, and Ubuntu Linux.
        
        Returns:
            str: The detected OS ('macos', 'windows', 'linux', or 'unsupported').
        """
        os_name = platform.system().lower()

        if os_name == 'darwin':
            return 'macos'
        elif os_name == 'windows':
            return 'windows'
        elif os_name == 'linux':
            return self._detect_linux_distribution()
        else:
            return 'unsupported'

    def _detect_linux_distribution(self):
        """
        Checks if the Linux distribution is Ubuntu.
        
        Returns:
            str: 'linux' if Ubuntu, otherwise 'unsupported'.
        """
        try:
            with open("/etc/os-release") as f:
                if "ubuntu" in f.read().lower():
                    return 'linux'
                else:
                    return 'unsupported'
        except FileNotFoundError:
            return 'unsupported'


if __name__ == "__main__":
    os_detector = OSDetector()
    os_type = os_detector.detect_os()
    print(f"Detected OS: {os_type}")
