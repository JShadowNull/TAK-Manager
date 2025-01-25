const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { sendLog, updateStatus, setStatusHandler, setMainWindow } = require('./utils/logger');
const { createWindow, waitForService, loadURL, loadFile } = require('./window/windowManager');
const { 
  checkDocker, 
  installDocker, 
  startDocker, 
  startContainer, 
  stopContainer 
} = require('./services/docker');

let isInitialLaunch = true;
let mainWindow = null;
let setupPending = false;
let setupInProgress = false;
let pathSelected = false;

// Handle SSL/Certificate errors
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// Configure external link handling
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('https://localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

// Disable SSL certificate validation for fetch requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Set up status handling early
setStatusHandler((text) => {
  // Add any main-process-specific handling here
  console.log(`Main Process Status: ${text}`);
});

// Store path in user data
function getStoredPath() {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.installPath;
    }
  } catch (error) {
    console.error('Failed to read config:', error);
  }
  return null;
}

// Save path to user data
function storePath(installPath) {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');
  
  try {
    const config = { installPath };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write config:', error);
    return false;
  }
}

// Update env file with installation path
async function updateEnvFile(installPath) {
  const resourcePath = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), '..')
  const envPath = path.join(resourcePath, '.env')
  
  try {
    // Read existing env file or create new one
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add TAK_SERVER_INSTALL_DIR
    if (envContent.includes('TAK_SERVER_INSTALL_DIR=')) {
      envContent = envContent.replace(
        /TAK_SERVER_INSTALL_DIR=.*/,
        `TAK_SERVER_INSTALL_DIR=${installPath}`
      );
    } else {
      envContent += `\nTAK_SERVER_INSTALL_DIR=${installPath}`;
    }

    // Ensure newline at end of file
    envContent = envContent.trim() + '\n';

    fs.writeFileSync(envPath, envContent);
    return true;
  } catch (error) {
    console.error('Failed to update env file:', error);
    sendLog(`Failed to update env file: ${error.message}`, 'error');
    return false;
  }
}

async function runSetup(force = false) {
  if (setupInProgress && !force) return;
  
  try {
    setupInProgress = true;
    updateStatus('Starting setup process...');

    // First check for path selection
    const storedPath = getStoredPath();
    if (!storedPath && !pathSelected) {
      updateStatus('Waiting for installation directory selection...');
      setupInProgress = false;
      return;
    }

    // Then check Docker
    updateStatus('Checking Docker installation...');
    const hasDocker = await checkDocker();
    
    if (!hasDocker) {
      await installDocker();
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Proceed with configuration
    updateStatus('Configuring environment...');
    const envUpdated = await updateEnvFile(storedPath);
    if (!envUpdated) throw new Error('Environment configuration failed');

    updateStatus('Starting Docker...');
    await startDocker();
    
    updateStatus('Starting containers...');
    await startContainer();
    
    updateStatus('Finalizing setup...');
    await waitForService('http://localhost:8989/health');

    mainWindow.loadURL('http://localhost:8989');
    isInitialLaunch = false;
  } catch (error) {
    updateStatus(`Setup Error: ${error.message}`);
    sendLog(error.message, 'error');
  } finally {
    setupInProgress = false;
    pathSelected = false;
  }
}

// IPC Handlers
ipcMain.handle('dialog:selectInstallPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select TAK Server Installation Directory'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-install-path', () => {
  return getStoredPath();
});

ipcMain.handle('set-install-path', async (event, path) => {
  try {
    console.log('[DEBUG] Setting install path:', path);
    if (!storePath(path)) throw new Error('Failed to save path');
    if (!(await updateEnvFile(path))) throw new Error('Failed to update env');
    
    pathSelected = true;
    if (isInitialLaunch) {
      console.log('[DEBUG] Initial launch, restarting setup');
      runSetup(true); // Force restart setup with new path
    }
    return true;
  } catch (error) {
    console.error('[DEBUG] Error in set-install-path:', error);
    sendLog(error.message, 'error');
    return false;
  }
});

let isQuitting = false;

// Handle application startup
app.whenReady().then(async () => {
  console.log('[DEBUG] App ready, creating window');
  mainWindow = createWindow();
  console.log('[DEBUG] Window created, setting in logger');
  setMainWindow(mainWindow);
  console.log('[DEBUG] Window set in logger');

  // Wait a moment for window to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('[DEBUG] Window initialization delay complete');

  if (isInitialLaunch) {
    console.log('[DEBUG] Initial launch, loading index.html');
    mainWindow.loadFile('src/ui/index.html');
    // Start setup process after a short delay
    setTimeout(() => {
      console.log('[DEBUG] Starting setup process');
      updateStatus('Starting setup process...');
      runSetup();
    }, 1500);
  } else {
    console.log('[DEBUG] Not initial launch, loading URL');
    mainWindow.loadURL('http://localhost:8989');
  }

  app.on('activate', () => {
    console.log('[DEBUG] App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[DEBUG] No windows, creating new one');
      mainWindow = createWindow();
      setMainWindow(mainWindow);
      // Restore the URL when window is recreated
      mainWindow.loadURL('http://localhost:8989');
    } else {
      // If window exists but is hidden, show it
      mainWindow.show();
    }
  });
});

// Handle application shutdown
app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    updateStatus('Stopping containers...');
    
    stopContainer()
      .then(() => {
        isQuitting = true;
        app.quit();
      })
      .catch((error) => {
        sendLog('Failed to stop containers:', error, 'error');
        isQuitting = true;
        app.quit();
      });
  }
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
