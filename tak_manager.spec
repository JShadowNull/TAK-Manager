# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Collect all necessary data for eventlet and dns
datas = [
    ('dist', 'dist'),  # Frontend production build files
    ('backend', 'backend'),  # Include entire backend directory
]

# Collect all package data
eventlet_datas, eventlet_binaries, eventlet_hiddenimports = collect_all('eventlet')
dns_datas, dns_binaries, dns_hiddenimports = collect_all('dns')
flask_socketio_datas, flask_socketio_binaries, flask_socketio_hiddenimports = collect_all('flask_socketio')
webview_datas, webview_binaries, webview_hiddenimports = collect_all('webview')

# Add collected data to our lists
datas.extend(eventlet_datas)
datas.extend(dns_datas)
datas.extend(flask_socketio_datas)
datas.extend(webview_datas)

# Combine all binaries
binaries = []
binaries.extend(eventlet_binaries)
binaries.extend(dns_binaries)
binaries.extend(flask_socketio_binaries)
binaries.extend(webview_binaries)

a = Analysis(
    ['app.py'],  # Using production app.py
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=[
        'flask',
        'flask_socketio',
        'flask_cors',
        'eventlet',
        'engineio.async_drivers.eventlet',
        'eventlet.hubs',
        'eventlet.hubs.hub',
        'eventlet.hubs.epolls',
        'eventlet.hubs.kqueue',
        'eventlet.hubs.selects',
        'eventlet.hubs.poll',
        'eventlet.green.subprocess',
        'eventlet.green.threading',
        'eventlet.green.thread',
        'eventlet.green.os',
        'eventlet.green.select',
        'eventlet.green.socket',
        'eventlet.green.ssl',
        'eventlet.support',
        'eventlet.support.greendns',
        'eventlet.support.greenlets',
        'eventlet.support.psycopg2_patcher',
        'dns',
        'dns.asyncbackend',
        'dns.asyncquery',
        'dns.asyncresolver',
        'dns.dnssec',
        'dns.e164',
        'dns.edns',
        'dns.entropy',
        'dns.exception',
        'dns.flags',
        'dns.grange',
        'dns.hash',
        'dns.inet',
        'dns.ipv4',
        'dns.ipv6',
        'dns.message',
        'dns.name',
        'dns.namedict',
        'dns.node',
        'dns.opcode',
        'dns.query',
        'dns.rcode',
        'dns.rdata',
        'dns.rdataclass',
        'dns.rdataset',
        'dns.rdatatype',
        'dns.renderer',
        'dns.resolver',
        'dns.reversename',
        'dns.rrset',
        'dns.set',
        'dns.tokenizer',
        'dns.tsig',
        'dns.tsigkeyring',
        'dns.ttl',
        'dns.update',
        'dns.version',
        'dns.versioned',
        'dns.wiredata',
        'dns.zone',
        'werkzeug',
        'jinja2',
        'markupsafe',
        'bidict',
        'flask_socketio.namespace',
        'flask_socketio.test_client',
        'flask_socketio.async_handlers',
        'flask_socketio.async_drivers',
        'flask_socketio.event',
        'flask_socketio.utils',
        'webview',
        'webview.platforms.cocoa',
    ] + eventlet_hiddenimports + dns_hiddenimports + flask_socketio_hiddenimports + webview_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Tak Manager',
    debug=False,  # Set to False for production
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Set to False for production
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Tak Manager',
)

app = BUNDLE(
    coll,
    name='Tak Manager.app',
    icon=None,
    bundle_identifier='com.takmanager.app',
    info_plist={
        'NSHighResolutionCapable': True,
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'LSMinimumSystemVersion': '10.13.0',
        'NSRequiresAquaSystemAppearance': False,
    },
) 