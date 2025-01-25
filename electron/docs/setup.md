# TAK Manager Desktop App

Simple Electron wrapper that manages Docker container lifecycle

## Features
- 🐳 Auto-installs Docker Desktop if missing
- ▶️ Starts containers on app launch
- ⏹️ Stops containers on app exit
- 🌀 Shows loading screen during setup
- ✔️ Verifies Docker service status

## Quick Start

### 1. Install Requirements
```bash
# Install Node.js (https://nodejs.org)
# Install build tools
npm install -g electron electron-builder
```

### 2. Create Project
```bash
mkdir tak-manager && cd tak-manager
npm init -y
npm install electron@latest
```

### 3. File Structure
```
tak-manager/
├── src/
│   ├── main.js
│   ├── preload.js
│   └── ui/
│       ├── index.html
│       └── styles.css
├── docker/
│   └── docker-compose.yml
├── assets/
│   └── installers/
│       ├── Docker.dmg
│       └── DockerSetup.exe
└── package.json
```

### 4. Core Files

**package.json**
```json
{
  "name": "tak-manager",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "package": "electron-builder --mac --win"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0"
  },
  "build": {
    "extraResources": [
      {
        "from": "assets/installers",
        "to": "installers",
        "filter": ["**/*"]
      }
    ]
  }
}
```

**src/main.js**
```javascript
const { app, BrowserWindow, ipcMain } = require('electron')
const { exec, spawn } = require('child_process')
const path = require('path')

let mainWindow

async function checkDocker() {
  return new Promise(resolve => {
    exec('docker --version', (error) => resolve(!error))
  })
}

async function installDocker() {
  const installer = process.platform === 'darwin' 
    ? path.join(process.resourcesPath, 'installers', 'Docker.dmg')
    : path.join(process.resourcesPath, 'installers', 'DockerSetup.exe')

  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      exec(`hdiutil attach "${installer}" && cp -R "/Volumes/Docker Desktop/Docker Desktop.app" "/Applications/" && hdiutil detach "/Volumes/Docker Desktop"`, 
        (error) => error ? reject(error) : resolve())
    } else {
      const installerProcess = spawn(installer, ['/install', '/quiet', 'ACCEPT_EULA=1'])
      installerProcess.on('close', code => code === 0 ? resolve() : reject())
    }
  })
}

async function startDocker() {
  return new Promise(resolve => {
    exec(process.platform === 'darwin' ? 'open -a Docker' : 'Start-Service Docker',
      () => resolve())
  })
}

async function startContainer() {
  exec('docker compose -f docker/docker-compose.yml up -d')
}

async function stopContainer() {
  exec('docker compose -f docker/docker-compose.yml down')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  
  mainWindow.loadFile('src/ui/index.html')

  // Setup sequence
  setTimeout(async () => {
    try {
      mainWindow.webContents.send('status', 'Checking Docker...')
      
      if (!await checkDocker()) {
        mainWindow.webContents.send('status', 'Installing Docker...')
        await installDocker()
      }
      
      mainWindow.webContents.send('status', 'Starting Docker...')
      await startDocker()
      
      mainWindow.webContents.send('status', 'Starting app...')
      await startContainer()
      
      mainWindow.loadURL('http://localhost:8989')
    } catch (error) {
      mainWindow.webContents.send('status', `Error: ${error.message}`)
    }
  }, 1000)
}

app.whenReady().then(createWindow)
app.on('before-quit', stopContainer)
```

**src/ui/index.html**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      background: #1a1a1a;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      font-family: Arial;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p id="status">Initializing...</p>
  </div>
  <script>
    require('../preload.js')
    const updateStatus = (text) => {
      document.getElementById('status').textContent = text
    }
    window.electronAPI.onStatusUpdate(updateStatus)
  </script>
</body>
</html>
```

## Build & Run
```bash
# Development
npm start

# Create installers
npm run package
# Outputs to dist/ folder
```

## Platform Notes

### macOS
- Requires app notarization
- Users may need to allow app in Security settings

### Windows
- Needs admin privileges for Docker install
- May trigger SmartScreen warning (code signing recommended)

---

**Next Steps**  
- Add progress percentage  
- Implement error recovery  
- Add auto-update functionality  
- Create desktop shortcuts