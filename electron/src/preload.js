const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, value) => callback(value))
  },
  
  onLogMessage: (callback) => {
    ipcRenderer.on('log-message', (_event, value) => callback(value))
  },
  
  // TAK installation path methods
  selectInstallPath: () => ipcRenderer.invoke('dialog:selectInstallPath'),
  getInstallPath: () => ipcRenderer.invoke('get-install-path'),
  setInstallPath: (path) => ipcRenderer.invoke('set-install-path', path)
})