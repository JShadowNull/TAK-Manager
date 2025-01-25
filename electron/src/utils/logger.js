// logger.js
let mainWindow = null;
let statusUpdateHandler = null;

// Unified status update system
function updateStatus(text) {
  console.log('[DEBUG] updateStatus called with:', text);
  console.log('[DEBUG] mainWindow state:', {
    exists: !!mainWindow,
    isDestroyed: mainWindow ? mainWindow.isDestroyed() : 'N/A'
  });

  // Log to console for debugging
  console.log(`[STATUS] ${text}`);
  
  try {
    // Send to renderer if window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[DEBUG] Attempting to send status to renderer');
      mainWindow.webContents.send('status-update', text);
      console.log('[DEBUG] Status sent successfully');
    }
    
    // Handle optional callback
    if (statusUpdateHandler) {
      console.log('[DEBUG] Calling status handler');
      statusUpdateHandler(text);
    }
  } catch (error) {
    console.error('[DEBUG] Error in updateStatus:', error);
  }
}

// Send log message to renderer
function sendLog(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', { message, type });
    }
  } catch (error) {
    console.error('[DEBUG] Error in sendLog:', error);
  }
}

// Add ability to set custom handler
function setStatusHandler(handler) {
  statusUpdateHandler = handler;
}

// Set the main window reference
function setMainWindow(window) {
  console.log('[DEBUG] setMainWindow called with window:', !!window);
  mainWindow = window;
}

module.exports = {
  setMainWindow,
  sendLog,
  updateStatus,
  setStatusHandler
};