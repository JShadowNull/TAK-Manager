const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { updateStatus } = require('../../utils/logger')

// Import platform-specific implementations
const macosImpl = require('./platforms/macos')
const windowsImpl = require('./platforms/windows')

// Get platform-specific implementation
const platformImpl = process.platform === 'darwin' ? macosImpl : windowsImpl

// Export platform-specific functions
const {
  getDockerPath,
  checkDocker,
  installDocker,
  startDocker,
  loadDockerImage
} = platformImpl

// Start Docker containers (platform-independent)
async function startContainer() {
  return new Promise(async (resolve, reject) => {
    try {
      // In development: electron/src/services/docker -> electron/src -> electron -> project root
      const resourcePath = app.isPackaged 
        ? process.resourcesPath 
        : path.join(__dirname, '..', '..', '..', '..')

      // Check if required files exist
      const composeFile = path.join(resourcePath, 'docker-compose.prod.yml')
      const envFile = path.join(resourcePath, '.env')
      
      // Look for tar file in dist directory
      const distDir = path.join(resourcePath, 'dist')
      
      console.log('Looking for Docker image in:', distDir)
      
      if (!fs.existsSync(distDir)) {
        throw new Error(`Dist directory not found at: ${distDir}`)
      }

      const tarFiles = fs.readdirSync(distDir)
        .filter(file => file.startsWith('tak-manager-') && file.endsWith('.tar.gz'))
        .sort((a, b) => b.localeCompare(a)) // Sort in descending order to get latest version first
      console.log('Found tar files:', tarFiles)
      
      const imageTarPath = tarFiles.length > 0 
        ? path.join(distDir, tarFiles[0])
        : null

      if (!fs.existsSync(composeFile)) {
        throw new Error(`Docker Compose file not found at: ${composeFile}`)
      }

      if (!fs.existsSync(envFile)) {
        throw new Error(`Environment file not found at: ${envFile}`)
      }

      // Load image from tar if available
      if (imageTarPath) {
        console.log('Loading Docker image from:', imageTarPath)
        // Extract version from filename (e.g., tak-manager-1.0.1.tar.gz -> 1.0.1)
        const version = path.basename(imageTarPath).match(/tak-manager-([\d.]+)\.tar\.gz/)[1]
        await loadDockerImage(imageTarPath, version)
      } else {
        throw new Error('No Docker image found in dist directory')
      }

      // Set up environment with system paths
      const env = {
        ...process.env,
        PATH: process.platform === 'darwin' 
          ? '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
          : process.env.PATH
      }

      updateStatus('Starting Docker containers...')
      const command = `"${getDockerPath()}" compose --env-file "${envFile}" -f "${composeFile}" up -d`
      
      exec(command, { 
        cwd: path.dirname(composeFile),
        env: env
      }, (error) => {
        if (error) {
          const errorMsg = `Failed to start containers: ${error.message}`
          updateStatus(errorMsg)
          reject(new Error(errorMsg))
          return
        }
        updateStatus('Docker containers started successfully')
        resolve()
      })
    } catch (error) {
      updateStatus(error.message)
      reject(error)
    }
  })
}

// Stop Docker containers (platform-independent)
async function stopContainer() {
  return new Promise((resolve, reject) => {
    // In development: electron/src/services/docker -> electron/src -> electron -> project root
    const resourcePath = app.isPackaged 
      ? process.resourcesPath 
      : path.join(__dirname, '..', '..', '..', '..')
    
    const composeFile = path.join(resourcePath, 'docker-compose.prod.yml')
    const envFile = path.join(resourcePath, '.env')

    // Set up environment with system paths
    const env = {
      ...process.env,
      PATH: process.platform === 'darwin'
        ? '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
        : process.env.PATH
    };

    if (!fs.existsSync(composeFile) || !fs.existsSync(envFile)) {
      updateStatus('Required files not found, attempting force removal...')
      exec(`"${getDockerPath()}" rm -f tak-manager-production`, { env: env }, (error) => {
        if (error) {
          const errorMsg = `Failed to force stop containers: ${error.message}`
          updateStatus(errorMsg)
          reject(new Error(errorMsg))
          return
        }
        updateStatus('Containers stopped successfully')
        resolve()
      })
      return
    }

    updateStatus('Attempting graceful container shutdown...')
    const command = `"${getDockerPath()}" compose --env-file "${envFile}" -f "${composeFile}" down`
    
    exec(command, { 
      cwd: path.dirname(composeFile),
      env: env 
    }, (error) => {
      if (error) {
        updateStatus('Graceful shutdown failed, forcing container removal...')
        exec(`"${getDockerPath()}" rm -f tak-manager-production`, { env: env }, (error) => {
          if (error) {
            const errorMsg = `Failed to force stop containers: ${error.message}`
            updateStatus(errorMsg)
            reject(new Error(errorMsg))
            return
          }
          updateStatus('Containers stopped successfully')
          resolve()
        })
      } else {
        updateStatus('Containers stopped successfully')
        resolve()
      }
    })

    // Fallback force stop after timeout
    setTimeout(() => {
      updateStatus('Shutdown timeout reached, forcing container removal...')
      exec(`"${getDockerPath()}" rm -f tak-manager-production`, { env: env }, () => {
        updateStatus('Containers forcefully removed')
        resolve()
      })
    }, 10000)
  })
}

module.exports = {
  checkDocker,
  installDocker,
  startDocker,
  startContainer,
  stopContainer
} 