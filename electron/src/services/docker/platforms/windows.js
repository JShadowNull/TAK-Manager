const { exec, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { updateStatus } = require('../../../utils/logger')

// Get Docker path for Windows
function getDockerPath() {
  const paths = [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe'
  ]
  for (const dockerPath of paths) {
    if (fs.existsSync(dockerPath)) {
      return dockerPath
    }
  }
  return 'docker' // Fallback to PATH lookup
}

// Get installer path for Windows
async function getInstallerPath() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const basePath = isDev ? app.getAppPath() : process.resourcesPath;
  return path.join(
    basePath,
    isDev ? 'assets/installers' : 'installers',
    'DockerSetup.exe'
  );
}

// Check if Docker is installed and running on Windows
async function checkDocker() {
  return new Promise((resolve) => {
    updateStatus('Checking Docker installation status...');

    // Check if Docker Desktop is installed
    const dockerDesktopPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    const isDockerDesktopInstalled = fs.existsSync(dockerDesktopPath);

    // Check for Docker CLI installation
    exec('where docker', async (whereError, whereOutput) => {
      const isDockerCliInstalled = !whereError && whereOutput.trim().length > 0;

      // If neither Docker Desktop nor CLI is installed
      if (!isDockerDesktopInstalled && !isDockerCliInstalled) {
        resolve(false);
        return;
      }

      // If Docker is installed (either Desktop or CLI), we consider it as installed
      resolve(true);
    });
  });
}

// Add a new function to check if Docker is running
async function isDockerRunning() {
  return new Promise((resolve) => {
    // Check Docker CLI functionality first
    exec('docker info', (cliError) => {
      if (!cliError) {
        resolve(true);
        return;
      }

      // If CLI check failed, check if Docker Desktop is running
      exec('tasklist /FI "IMAGENAME eq Docker Desktop.exe"', (taskError, taskOutput) => {
        const isDockerDesktopRunning = !taskError && taskOutput.toLowerCase().includes('docker desktop.exe');
        
        if (isDockerDesktopRunning) {
          // Give it a moment to be fully responsive
          setTimeout(() => {
            exec('docker info', (finalError) => {
              resolve(!finalError);
            });
          }, 2000);
          return;
        }

        // Finally check if Docker service is running
        exec('sc query docker', (serviceError, serviceOutput) => {
          const isServiceRunning = !serviceError && serviceOutput.includes('RUNNING');
          resolve(isServiceRunning);
        });
      });
    });
  });
}

// Install Docker on Windows
async function installDocker() {
  return new Promise(async (resolve, reject) => {
    const installer = await getInstallerPath();
    updateStatus('Starting Windows Docker installation...')
    
    if (!fs.existsSync(installer)) {
      const error = `Docker installer not found at: ${installer}`
      updateStatus(error)
      reject(new Error(error));
      return;
    }
    
    const installerProcess = spawn(installer, ['install', '--quiet', '--accept-license']);
    
    installerProcess.stdout.on('data', (data) => {
      updateStatus(`Installation: ${data.toString().trim()}`)
    });
    
    installerProcess.stderr.on('data', (data) => {
      updateStatus(`Installation error: ${data.toString().trim()}`)
    });
    
    installerProcess.on('close', code => {
      if (code === 0) {
        updateStatus('Windows Docker installation completed successfully')
        resolve();
      } else {
        const error = `Docker installation failed with exit code: ${code}`
        updateStatus(error)
        reject(new Error(error));
      }
    });
  });
}

// Start Docker on Windows
async function startDocker() {
  return new Promise((resolve, reject) => {
    const dockerDesktopPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    const isDockerDesktopInstalled = fs.existsSync(dockerDesktopPath);

    if (isDockerDesktopInstalled) {
      updateStatus('Starting Docker Desktop...');
      
      // Check if Docker Desktop is already running
      exec('tasklist /FI "IMAGENAME eq Docker Desktop.exe"', (taskError, taskOutput) => {
        const isRunning = !taskError && taskOutput.toLowerCase().includes('docker desktop.exe');
        
        if (!isRunning) {
          // Start Docker Desktop
          spawn(dockerDesktopPath, [], { detached: true });
        }
        
        // Wait for Docker to be responsive
        let attempts = 0;
        const maxAttempts = 90; // 3 minutes with 2-second intervals
        
        const checkDockerStatus = () => {
          exec('docker info', (error) => {
            if (!error) {
              updateStatus('Docker Desktop is running and responsive');
              resolve();
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkDockerStatus, 2000);
            } else {
              const timeoutError = 'Docker startup timed out after 3 minutes';
              updateStatus(timeoutError);
              reject(new Error(timeoutError));
            }
          });
        };
        
        checkDockerStatus();
      });
    } else {
      // Handle Docker CLI scenario
      updateStatus('Starting Docker service...');
      exec('sc start docker', (error) => {
        if (error) {
          const serviceError = 'Failed to start Docker service';
          updateStatus(serviceError);
          reject(new Error(serviceError));
          return;
        }

        // Wait for Docker daemon to be responsive
        let attempts = 0;
        const maxAttempts = 30; // 1 minute with 2-second intervals

        const checkDaemonStatus = () => {
          exec('docker info', (error) => {
            if (!error) {
              updateStatus('Docker service is running and responsive');
              resolve();
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkDaemonStatus, 2000);
            } else {
              const timeoutError = 'Docker service startup timed out after 1 minute';
              updateStatus(timeoutError);
              reject(new Error(timeoutError));
            }
          });
        };

        checkDaemonStatus();
      });
    }
  });
}

// Load Docker image from tar file for Windows
async function loadDockerImage(imagePath, version) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(imagePath)) {
      const error = `Docker image tar file not found at: ${imagePath}`
      updateStatus(error)
      return reject(new Error(error))
    }

    updateStatus('Loading Docker image from tar file...')
    const loadCommand = `"${getDockerPath()}" load -i "${imagePath}"`
    
    exec(loadCommand, {
      env: {
        ...process.env
      }
    }, (loadError, stdout) => {
      if (loadError) {
        const errorMsg = `Failed to load Docker image: ${loadError.message}`
        updateStatus(errorMsg)
        reject(new Error(errorMsg))
        return
      }

      // Extract the loaded image info from stdout
      const loadedImageMatch = stdout.match(/Loaded image: (.+)/) || stdout.match(/Loaded image ID: (sha256:[a-f0-9]+)/)
      if (!loadedImageMatch) {
        const errorMsg = 'Could not determine loaded image information'
        updateStatus(errorMsg)
        reject(new Error(errorMsg))
        return
      }

      const loadedImage = loadedImageMatch[1]
      
      // Tag the image with the correct version
      const tagCommand = `"${getDockerPath()}" tag ${loadedImage} tak-manager:${version}`
      exec(tagCommand, {
        env: {
          ...process.env
        }
      }, (tagError) => {
        if (tagError) {
          const errorMsg = `Failed to tag Docker image: ${tagError.message}`
          updateStatus(errorMsg)
          reject(new Error(errorMsg))
          return
        }
        updateStatus(`Docker image loaded and tagged as tak-manager:${version}`)
        resolve()
      })
    })
  })
}

module.exports = {
  getDockerPath,
  checkDocker,
  installDocker,
  startDocker,
  isDockerRunning,
  loadDockerImage
} 