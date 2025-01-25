const { BrowserWindow } = require('electron')
const path = require('path')
const fetch = require('node-fetch')

let mainWindow = null;
let lastLoadedUrl = null;

// Create the main application window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        frame: process.platform !== 'darwin',
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false, // Don't show until ready
        center: true,
        vibrancy: 'under-window',
        visualEffectState: 'active'
    })
    
    // Gracefully show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })
    
    // Store the last loaded URL when loading new URLs
    mainWindow.webContents.on('did-finish-load', () => {
        lastLoadedUrl = mainWindow.webContents.getURL();
    });
    
    return mainWindow;
}

// Get the main window instance
function getMainWindow() {
    return mainWindow;
}

// Get the last loaded URL
function getLastLoadedUrl() {
    return lastLoadedUrl;
}

// Wait for service to be ready
async function waitForService(url, maxAttempts = 30) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
            } catch (error) {
                console.log(`Attempt ${attempts}/${maxAttempts}: Service not ready yet`);
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error(`Service failed to become ready after ${maxAttempts} attempts`));
            }
        }, 2000);
    });
}

// Load the initial URL
function loadURL(url) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
    }
}

// Load a local file
function loadFile(filePath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(filePath);
    }
}

module.exports = {
    createWindow,
    getMainWindow,
    waitForService,
    loadURL,
    loadFile,
    getLastLoadedUrl
} 