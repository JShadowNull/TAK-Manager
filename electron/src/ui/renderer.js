document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById('status')
  const pathSelectionDiv = document.getElementById('pathSelection')
  const selectPathButton = document.getElementById('selectPath')
  const continueButton = document.getElementById('continueSetup')
  const selectedPathDiv = document.getElementById('selectedPath')
  const errorDiv = document.getElementById('error')
  
  let selectedPath = ''
  let setupInProgress = false
  let pathSelectionShown = false

  // Handle status updates
  window.electronAPI.onStatusUpdate((text) => {
    if (text && statusElement) {
      statusElement.textContent = text
      console.log('Status updated:', text)

      // Show path selection when needed
      if (text.includes('Waiting for installation directory selection') && !setupInProgress && !pathSelectionShown) {
        showPathSelection()
        pathSelectionShown = true
      }
      
      // Hide path selection and clear error when moving forward
      if (text.includes('Configuring environment') || 
          text.includes('Starting Docker containers')) {
        hidePathSelection()
        errorDiv.textContent = ''
      }

      // Show error div for setup errors
      if (text.includes('Setup Error:')) {
        errorDiv.textContent = text
        setupInProgress = false
        pathSelectionShown = false
        enableButtons()
      }
    }
  })

  // Handle log messages
  window.electronAPI.onLogMessage((message) => {
    if (message && statusElement) {
      const { text, type } = message
      console.log(`[${type.toUpperCase()}] ${text}`)
      
      // Show errors in error div
      if (type === 'error') {
        errorDiv.textContent = text
        setupInProgress = false
        pathSelectionShown = false
        enableButtons()
      }
    }
  })

  function enableButtons() {
    selectPathButton.disabled = false
    continueButton.disabled = !selectedPath
  }

  function disableButtons() {
    selectPathButton.disabled = true
    continueButton.disabled = true
  }

  // Show path selection UI
  function showPathSelection() {
    pathSelectionDiv.classList.add('visible')
    enableButtons()
    errorDiv.textContent = ''
  }

  // Hide path selection UI
  function hidePathSelection() {
    pathSelectionDiv.classList.remove('visible')
    disableButtons()
    pathSelectionShown = false
  }

  // Update selected path display
  function updateSelectedPath(path) {
    selectedPath = path
    if (path) {
      selectedPathDiv.textContent = `Selected: ${path}`
      selectedPathDiv.classList.add('visible')
      continueButton.disabled = !path || setupInProgress
    } else {
      selectedPathDiv.textContent = ''
      selectedPathDiv.classList.remove('visible')
      continueButton.disabled = true
    }
  }

  // Handle path selection
  selectPathButton.addEventListener('click', async () => {
    if (setupInProgress) return;
    
    try {
      errorDiv.textContent = ''
      selectPathButton.disabled = true
      statusElement.textContent = 'Selecting installation directory...'
      
      // Open directory selection dialog
      const path = await window.electronAPI.selectInstallPath()
      
      if (path) {
        updateSelectedPath(path)
        statusElement.textContent = 'Directory selected. Click Continue to proceed.'
      } else {
        statusElement.textContent = 'Waiting for installation directory selection...'
      }
    } catch (error) {
      errorDiv.textContent = error.message || 'Failed to set installation directory'
      console.error('Path selection error:', error)
      statusElement.textContent = 'Installation directory selection failed'
    } finally {
      selectPathButton.disabled = false
    }
  })

  // Handle continue button
  continueButton.addEventListener('click', async () => {
    if (setupInProgress || !selectedPath) return;
    
    try {
      setupInProgress = true;
      errorDiv.textContent = '';
      disableButtons();
      statusElement.textContent = 'Saving configuration...';
  
      const success = await window.electronAPI.setInstallPath(selectedPath);
      if (!success) throw new Error('Failed to save path');
      
      statusElement.textContent = 'Configuration saved. Continuing setup...';
      hidePathSelection();
    } catch (error) {
      errorDiv.textContent = error.message;
      setupInProgress = false;
      enableButtons();
    }
  })

  // Check if we need to show path selection on startup
  async function checkPathOnStartup() {
    try {
      const existingPath = await window.electronAPI.getInstallPath()
      if (existingPath) {
        updateSelectedPath(existingPath)
      }
    } catch (error) {
      console.error('Failed to check existing path:', error)
    }
  }

  // Run startup check
  checkPathOnStartup()
})