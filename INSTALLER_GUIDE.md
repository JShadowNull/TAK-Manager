# TAK Manager Installer Guide

This guide outlines the process of creating native-like installers for TAK Manager on both macOS and Windows platforms.

## Overview

The installer will:
1. Check/Install Docker if not present
2. Allow users to select TAK Server installation directory
3. Configure environment variables
4. Build and start Docker containers
5. Create a native-like application launcher
6. Handle Docker dependency checks on launch
7. Provide PWA-based native experience

## macOS Implementation

### Tools Required
- Create-DMG
- Platypus (for creating native app wrapper)
- Docker Desktop for Mac installer

### Implementation Steps

1. **Create Main App Bundle**
   ```bash
   # Structure
   TAKManager.app/
   ├── Contents/
   │   ├── MacOS/
   │   │   └── launcher.sh
   │   ├── Resources/
   │   │   ├── tak.icns
   │   │   └── docker-compose.yml
   │   └── Info.plist
   ```

2. **launcher.sh Script**
   ```bash
   #!/bin/bash
   
   # Check if Docker is running
   if ! docker info >/dev/null 2>&1; then
     open -a Docker
     # Wait for Docker to start
     while ! docker info >/dev/null 2>&1; do
       sleep 1
     done
   fi
   
   # Check if container is running
   if ! docker compose ps | grep -q "tak-manager"; then
     cd "$(dirname "$0")/../Resources"
     docker compose up -d
   fi
   
   # Launch web app
   open -a "Safari" --args --app="http://localhost:8989"
   ```

3. **Create DMG Installer**
   - Package the app bundle
   - Include Docker Desktop installer
   - Add installation script
   - Include directory selection dialog
   - Set up environment variables

### Installation Flow
1. User downloads and opens DMG
2. Drags TAK Manager to Applications
3. On first launch:
   - Checks for Docker, installs if needed
   - Prompts for TAK Server directory
   - Configures environment
   - Builds containers
   - Creates PWA shortcut

## Windows Implementation

### Tools Required
- Inno Setup
- Docker Desktop for Windows installer
- PowerShell scripts

### Implementation Steps

1. **Create Installer Script (install.iss)**
   ```pascal
   [Setup]
   AppName=TAK Manager
   AppVersion=1.0.0
   DefaultDirName={pf}\TAK Manager
   OutputBaseFilename=TAKManagerSetup
   
   [Files]
   Source: "Docker Desktop Installer.exe"; DestDir: "{tmp}"
   Source: "launcher.ps1"; DestDir: "{app}"
   Source: "tak.ico"; DestDir: "{app}"
   
   [Run]
   Filename: "{tmp}\Docker Desktop Installer.exe"; Check: DockerNotInstalled
   ```

2. **PowerShell Launcher (launcher.ps1)**
   ```powershell
   # Check Docker status
   if (-not (Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue)) {
       Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
       Start-Sleep -Seconds 30
   }
   
   # Check container
   $containerRunning = docker compose ps | Select-String "tak-manager"
   if (-not $containerRunning) {
       Set-Location $PSScriptRoot
       docker compose up -d
   }
   
   # Launch PWA
   Start-Process "chrome.exe" -ArgumentList "--app=http://localhost:8989"
   ```

3. **Create Shortcut**
   ```powershell
   $WshShell = New-Object -comObject WScript.Shell
   $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\TAK Manager.lnk")
   $Shortcut.TargetPath = "powershell.exe"
   $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$installDir\launcher.ps1`""
   $Shortcut.IconLocation = "$installDir\tak.ico"
   $Shortcut.Save()
   ```

### Installation Flow
1. User runs installer
2. Checks/Installs Docker Desktop
3. Prompts for TAK Server directory
4. Sets up environment
5. Creates desktop shortcut
6. Builds containers on first launch

## Common Features

### Environment Setup
- Store TAK Server path in app configuration
- Create .env file with selected paths
- Configure Docker volumes

### PWA Configuration
- Install as Chrome PWA on first launch
- Create desktop shortcut to PWA
- Handle offline capabilities

### Error Handling
- Docker not running
- Container build failures
- Network issues
- Permission problems

## Development Tasks

1. **Create Build Scripts**
   - macOS DMG creation
   - Windows installer compilation
   - Asset packaging

2. **Testing Procedures**
   - Fresh OS installations
   - Docker installation verification
   - Permission handling
   - Network configurations

3. **Distribution**
   - Code signing
   - Notarization (macOS)
   - Update mechanisms

## Security Considerations

1. **Docker Security**
   - Minimal permissions
   - Volume access controls
   - Network isolation

2. **Application Security**
   - Secure storage of paths
   - Protected environment variables
   - Encrypted communications

## User Experience Guidelines

1. **Installation**
   - Minimal user input required
   - Clear progress indicators
   - Helpful error messages

2. **Launch Experience**
   - Fast startup
   - Automatic recovery
   - Native app feel

3. **Updates**
   - Automatic container updates
   - PWA updates
   - Docker updates handling

## Container Packaging

### Pre-packaging Steps
1. Build the production container image:
   ```bash
   docker build -t tak-manager:latest .
   ```

2. Push to a container registry:
   ```bash
   docker tag tak-manager:latest ghcr.io/your-username/tak-manager:latest
   docker push ghcr.io/your-username/tak-manager:latest
   ```

3. Create installer package structure:
   ```bash
   installer/
   ├── common/
   │   ├── docker-compose.yml    # Production compose file
   │   └── .env.template         # Environment template
   ├── macos/
   │   └── TAKManager.app/      # macOS app bundle
   └── windows/
       └── setup/               # Windows installer files
   ```

### Installer Contents
Each installer should include:
1. Docker Desktop installer for the platform
2. Production docker-compose.yml
3. Platform-specific launcher scripts
4. Environment configuration templates

### First Launch Setup
1. Copy docker-compose.yml to app directory
2. Create .env file from template with user-selected paths
3. Pull container image from registry
4. Start containers using docker-compose

### Offline Installation Support
For environments without internet access:
1. Include container image in installer:
   ```bash
   # Save image to file
   docker save -o tak-manager-image.tar ghcr.io/your-username/tak-manager:latest
   
   # In launcher script, load image if needed:
   if ! docker images | grep -q "tak-manager"; then
     docker load -i "${INSTALL_DIR}/tak-manager-image.tar"
   fi
   ```

2. Modify launcher scripts to check for local image before pulling 