from setuptools import setup

APP = ['app.py']
DATA_FILES = [
    ('frontend', ['frontend']),
    ('backend', ['backend']),
]

OPTIONS = {
    'argv_emulation': True,
    'packages': [
        'flask',
        'webview',
        'eventlet',
        'socketio',
        'psutil',
        'apkutils2',
        'bidict',
        'bottle',
        'cigam',
        'dnspython',
        'engineio',
        'flask_cors',
        'flask_socketio',
        'greenlet',
        'lxml',
        'pillow',
        'proxy_tools',
        'pure_python_adb',
        'pyelftools',
        'pyobjc',
        'python_dotenv',
        'requests',
        'retry',
        'simple_websocket',
        'xmltodict'
    ],
    'includes': [
        'jinja2',
        'jinja2.ext',
        'engineio.async_drivers.eventlet',
        'packaging',
        'packaging.version',
        'packaging.specifiers',
        'packaging.requirements',
    ],
    'excludes': [
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas'
    ],
    'resources': [
        'frontend/templates',
        'frontend/static',
        'backend/services/scripts'
    ],
    'plist': {
        'CFBundleName': 'Tak Manager',
        'CFBundleDisplayName': 'Tak Manager',
        'CFBundleGetInfoString': "Tak Manager",
        'CFBundleIdentifier': "com.yourcompany.takmanager",
        'CFBundleVersion': "1.0.0",
        'CFBundleShortVersionString': "1.0.0",
        'NSHighResolutionCapable': True,
        'NSRequiresAquaSystemAppearance': False,  # Allows Dark Mode support
        'LSMinimumSystemVersion': '10.13.0',  # Minimum macOS version
        'NSHumanReadableCopyright': u"Copyright © 2024, Your Company, All Rights Reserved"
    },
    'iconfile': 'frontend/static/img/app_icon.icns'
}

setup(
    name="Tak Manager",
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
    install_requires=[
        'apkutils2==1.0.0',
        'bidict==0.23.1',
        'blinker==1.8.2',
        'bottle==0.13.2',
        'certifi==2024.8.30',
        'charset-normalizer==3.4.0',
        'cigam==0.0.3',
        'click==8.1.7',
        'decorator==5.1.1',
        'deprecation==2.1.0',
        'dnspython==2.7.0',
        'eventlet==0.37.0',
        'Flask==3.0.3',
        'Flask-Cors==5.0.0',
        'Flask-SocketIO==5.4.1',
        'greenlet==3.1.1',
        'h11==0.14.0',
        'idna==3.10',
        'itsdangerous==2.2.0',
        'Jinja2==3.1.4',
        'lxml==5.3.0',
        'MarkupSafe==3.0.1',
        'packaging==24.2',
        'pexpect==4.9.0',
        'pillow==11.0.0',
        'proxy_tools==0.1.0',
        'psutil==6.1.0',
        'ptyprocess==0.7.0',
        'pure-python-adb==0.3.0.dev0',
        'py==1.11.0',
        'pyelftools==0.31',
        'pyobjc-core==10.3.1',
        'pyobjc-framework-Cocoa==10.3.1',
        'pyobjc-framework-Quartz==10.3.1',
        'pyobjc-framework-Security==10.3.1',
        'pyobjc-framework-WebKit==10.3.1',
        'python-dotenv==1.0.1',
        'python-engineio==4.10.1',
        'python-socketio==5.11.4',
        'pywebview==5.3',
        'requests==2.32.3',
        'retry==0.9.2',
        'simple-websocket==1.1.0',
        'typing_extensions==4.12.2',
        'urllib3==2.2.3',
        'Werkzeug==3.0.4',
        'wsproto==1.2.0',
        'xmltodict==0.14.2'
    ]
) 