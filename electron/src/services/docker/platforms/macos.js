const { exec, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { updateStatus } = require('../../../utils/logger')

// Get Docker path for macOS
function getDockerPath() {
  const paths = [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
    '/Applications/Docker.app/Contents/MacOS/Docker'
  ]
  for (const dockerPath of paths) {
    if (fs.existsSync(dockerPath)) {
      return dockerPath
    }
  }
  return 'docker' // Fallback to PATH lookup
}

// Get installer path for macOS
async function getInstallerPath() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const basePath = isDev ? app.getAppPath() : process.resourcesPath;
  return path.join(
    basePath,
    isDev ? 'assets/installers' : 'installers',
    'Docker.dmg'
  );
}

// Check if Docker is installed on macOS
async function checkDocker() {
  return new Promise((resolve) => {
    updateStatus('Checking Docker installation status...');

    // Use AppleScript to check for Docker installation using bundle identifier
    const script = `
      tell application "System Events"
        return exists (file "Docker.app" of folder "Applications" of startup disk)
      end tell
    `;

    exec(`osascript -e '${script}'`, (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim() === 'true');
      }
    });
  });
}

// Install Docker on macOS
async function installDocker() {
  return new Promise(async (resolve, reject) => {
    try {
      updateStatus('Starting Docker installation...');
      const installerPath = await getInstallerPath();
      
      if (!fs.existsSync(installerPath)) {
        return reject(new Error('Docker installer not found'));
      }

      // Use absolute paths for system commands
      const installScript = `
        set dmgPath to POSIX file "${installerPath.replace(/"/g, '\\"')}"
        
        try
          -- Mount DMG using hdiutil with full path
          set mountCMD to "/usr/bin/hdiutil attach " & quoted form of POSIX path of dmgPath & " -nobrowse"
          set mountOutput to do shell script mountCMD
          
          -- Extract mount path using full path to grep
          set mountPath to do shell script "/usr/bin/grep -o '/Volumes/.*' <<< " & quoted form of mountOutput
          
          -- Wait for filesystem
          delay 2
          
          -- Copy with proper escaping using full path to cp
          set copyCMD to "/bin/cp -R " & quoted form of POSIX path of (mountPath & "/Docker.app") & " /Applications/"
          do shell script copyCMD with administrator privileges
          
          -- Cleanup using full path
          do shell script "/usr/bin/hdiutil detach " & quoted form of POSIX path of mountPath & " -force"
          
          -- Verify using full path to test
          do shell script "/bin/test -d /Applications/Docker.app" & " || exit 1"
          
          return true
        on error errMsg
          try
            do shell script "/usr/bin/hdiutil detach " & quoted form of POSIX path of mountPath & " -force"
          end try
          error "INSTALL_FAILED: " & errMsg
        end try
      `;

      const osa = spawn('osascript', ['-e', installScript]);
      let output = [];

      const timeout = setTimeout(() => {
        osa.kill();
        reject(new Error('Installation timed out after 2 minutes'));
      }, 120000);

      osa.stdout.on('data', (data) => {
        const message = data.toString().trim();
        output.push(message);
        updateStatus(`Installation: ${message}`);
      });

      osa.stderr.on('data', (data) => {
        const message = data.toString().trim();
        output.push(message);
        updateStatus(`Installation error: ${message}`);
      });

      osa.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          updateStatus('Docker installation completed successfully');
          resolve();
        } else {
          const error = `Installation failed: ${output.join(' ').trim()}`;
          updateStatus(error);
          reject(new Error(error));
        }
      });

    } catch (error) {
      updateStatus(`Docker installation failed: ${error.message}`);
      reject(error);
    }
  });
}

// Start Docker Desktop on macOS
async function startDocker() {
  return new Promise((resolve, reject) => {
    updateStatus('Launching Docker Desktop...');
    
    const script = `
      on isDockerRunning()
          if application "Docker" is running then return true
          
          tell application "Docker" to activate
          
          repeat 30 times
              if application "Docker" is running then exit repeat
              delay 2
          end repeat
          
          return application "Docker" is running
      end isDockerRunning
      
      if isDockerRunning() then
          do shell script "while ! /usr/local/bin/docker info &>/dev/null; do sleep 1; done"
          return true
      else
          return false
      end if
    `;

    const osa = spawn('osascript', ['-e', script]);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        osa.kill();
        updateStatus('Docker startup timed out after 2 minutes');
        reject(new Error('Docker startup timed out after 2 minutes'));
      }
    }, 120000);

    osa.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolved = true;
        updateStatus('Docker Desktop is running');
        resolve();
      } else if (!resolved) {
        updateStatus(`Docker startup failed with code ${code}`);
        reject(new Error(`Docker startup failed with code ${code}`));
      }
    });

    osa.stderr.on('data', (data) => {
      updateStatus(`Startup Error: ${data.toString().trim()}`);
    });
  });
}

// Load Docker image from tar file for macOS
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
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
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
          ...process.env,
          PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
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
  loadDockerImage
} 