# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.0.0] - 2025-02-21

## [2.0.0] - 2025-02-21


### Added 🚀


- Add database password reset utility for TAK server


### Changed 🔄


- Improve download handling for certificates and data packages
- Simplify window management and navigation
- Modernize data package generation and preferences management
- Reorganize project structure with API handlers
- Modernize data package management with improved error handling and UI interactions
- Clean up imports in data package manager
- Improve release script with interactive version input
- Enhance TAK server status and operation handling
- Improve TAK server status logging and error handling
- Simplify logging configuration in TAK server status script
- Update Docker Compose commands and improve TAK server status checks
- Enhance certificate and password validation with Zod schemas
- Update password validation symbol set
- Standardize password symbol set across components
- Improve TAK server uninstallation process and error handling
- Enhance certificate configuration with robust logging and error handling
- Enhance TAK server installer with improved logging and progress tracking


### Documentation 📦


- Add comprehensive TAK Server Management API documentation


### Fixed 🔧


- Improve Docker repository key and dependency installation in DockerfileProd


### Other 📦


- Upgrade pywebview to version 5.4
- Bump version to 1.1.3 in package-lock.json
- Update Docker base image and Docker installation in Dockerfiles
- Update tak-manager-wrapper submodule to latest commit
- Add prompt-sync package for interactive CLI input
- Release tak-manager@2.0.0 [skip ci]

## [1.1.3] - 2025-02-19

## [1.1.3] - 2025-02-19


### Added 🚀


- Enhance certificate management with improved UX and error handling
- Add optional up/down handler for input component
- Improve certificate management UI with toast variant and delete button state
- Enhance toast component with new color variants
- Add pywebview support for certificate downloads
- Add optional restart button control in certificate config dialog
- Enhance file dialog and download handling in webview
- Add server restart state management in TAK server context
- Enhance certificate configuration editor with advanced user management


### Changed 🔄


- Remove unused imports and simplify TAK server status script
- Improve certificate deletion process in CertManager
- Remove unused operation status handling in CertManager
- Remove unused onOperationProgress prop in ExistingCertificates
- Replace error state with toast notifications in ExistingCertificates
- Improve certificate download handling and UI interactions


### Fixed 🔧


- Improve version bump detection in release script


### Other 📦


- Bump version to v1.1.2
- Bump project version to 1.1.2
- Release tak-manager@1.1.3 [skip ci]

## [1.1.2] - 2025-02-17

## [1.1.2] - 2025-02-17


### Added 🚀


- Add advanced features page with ability to edit CoreConfig.xml
- Add backup management for CoreConfig.xml
- Increase default webview window size
- Add log viewer for TAK Server in Advanced Features
- Enhance password management in certificate and installation forms
- Add certificate configuration editing capability
- Implement LogManager for TAK Server log management
- Add CertConfigManager for XML certificate configuration management
- Add DirectoryHelper with comprehensive path management for TAK Server
- Add Radix UI Toast component and enhance OTA configuration UI
- Enhance CreateCertificates component with improved UX and toast notifications
- Set default protocol to SSL in CoT stream configuration


### Changed 🔄


- Update TAK Server scripts to use consistent directory paths
- Update data package directory paths
- Reorganize import paths for certificate and log management modules
- Centralize directory management with DirectoryHelper
- Simplify certificate file retrieval in data package route
- Enhance TAK Server status event handling and error management
- Improve OTA configuration form with enhanced validation and progress tracking
- Improve TAK Server operation and installation event handling
- Improve SSE event handling and queue management across routes
- Improve command execution and output handling in RunCommand
- Improve AdvancedFeatures tab and server status handling
- Improve TAK Server certificate configuration with robust service initialization


### Fixed 🔧


- Improve text selection and link styling across components
- Update SidebarTrigger to correctly pass mouse event to onClick handler
- Improve file input handling and form validation in TakServer installation
- Update working directory path for TAK Server OTA scripts
- Handle potential webview window creation errors


### Other 📦


- Remove deprecated configuration and documentation files
- Release tak-manager@1.1.2 [skip ci]

## [1.1.1] - 2025-02-14

## [1.1.1] - 2025-02-14


### Other 📦


- Merge branch 'dev' of ssh://10.72.72.25:2222/Jake/Tak-Manager into dev


### Added 🚀


- Existing certs page now properly links selected certs to package generator
- Add Existing Data Packages tab to Data Package page
- Add tooltips to TAK Server connection configuration fields


### Changed 🔄


- Improve ExistingCertificates UI layout and responsiveness
- Package generator select certs now only displays user certs


### Fixed 🔧


- Configure webview startup with local storage


### Other 📦


- Bump version to 1.1.0 and update submodule [skip ci]
- Simplify Windows docker image build script
- Remove unneeded requirements file
- Release tak-manager@1.1.1 [skip ci]

## [1.1.0] - 2025-02-14

## [1.1.0] - 2025-02-14


### Added 🚀


- Improve loading states and update checking logic in app component


### Other 📦


- Update tak-manager-wrapper submodule
- Update docker image build scripts and package version
- Merge dev into main for release
- Release tak-manager@1.1.0 [skip ci]

## [1.0.5] - 2025-02-14


### Added 🚀


- Add update checking and network features


### Fixed 🔧


- Correct release script command


### Other 📦


- Update server dependencies to latest versions
- Update package dependencies and version management

## [1.0.4] - 2025-02-14


### Changed 🔄


- Improve release process and version management
- Improve version bump detection in release script
- Simplify release script changelog and release generation
- Improve Gitea release script JSON handling and escaping


### Other 📦


- Merge dev into main for release
- Release tak-manager@1.0.4 [skip ci]
- Release tak-manager@1.0.5 [skip ci]
- Revert version and update release process
- Release tak-manager@1.0.6 [skip ci]
- Release tak-manager@1.0.7 [skip ci]
- Enhance changelog generation and release process
- Release tak-manager@1.0.8 [skip ci]
- Release tak-manager@1.0.9 [skip ci]
- Release tak-manager@1.0.10 [skip ci]
- Release tak-manager@1.0.11 [skip ci]
- Release tak-manager@1.0.12 [skip ci]
- Release tak-manager@1.0.13 [skip ci]
- Release tak-manager@1.0.14 [skip ci]
- Revert version to 1.0.3 and update release script
- Revert version to 1.0.3
- Revert version to 1.0.3 and clean up release artifacts
- Commit current changes
- Revert version to 1.0.3 and update release scripts
- Revert version to 1.0.3 and add Gitea token support in release script
- Revert version to 1.0.3 and improve Gitea release script
- Revert version to 1.0.3 and refactor release script
- Release tak-manager@1.1.0 [skip ci]
- Release tak-manager@1.2.0 [skip ci]
- Update wrapper submodule for v1.2.0
- Revert to version 1.0.3 and enhance release script
- Update wrapper submodule for v1.1.0
- Update wrapper submodule for v1.0.4

## [1.0.3] - 2025-02-13


### Other 📦


- Merge pull request 'feature overhaul' ([#6](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/6)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/6
- Merge pull request 'update changelog config' ([#7](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/7)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/7


### Added 🚀


- Add ability to download certificates
- Add number input with custom controls and styling
- Add option to hide input number arrows
- Enhance file input with drag-and-drop and custom styling
- Add changelog tracking
- Test commit to trigger version bump
- Test the updated post-commit hook
- Test the fixed post-commit hook
- Test the executable post-commit hook
- Test the fully fixed post-commit hook
- Final test of post-commit hook


### Fixed 🔧


- Changelog
- Update changelog
- Revert test feature number


### Other 📦


- Remove default browser scroll
- Bump version to 1.0.2 and update changelog
- Update tak-manager-wrapper submodule
- Update tak-manager-wrapper submodule to latest commit
- Update changelog
- Update changelog and add new npm script for changelog generation
- Enhance changelog generation and configuration
- Bump version to 1.0.3 and update project configuration
- Release version 1.0.3 with changelog and configuration updates
- Update CHANGELOG.md to version 1.0.3
- Update changelog generation script with repository parameters
- Update changelog generation script to use dynamic version
- Add standard-version for changelog and release management
- Release tak-manager@1.0.3 [skip ci]
- Release tak-manager@1.1.0 [skip ci]
- Merge tak-manager@1.1.0 from dev [skip ci]
- Merge tak-manager@1.0.3 from dev [skip ci]
- Add release script to package.json
- Merge dev into main for release
- Update release script to use custom Node.js release script

## [1.0.1] - 2025-02-09


### Other 📦


- Delete FETCH_HEAD
- Merge pull request 'add windows package' ([#4](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/4)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/4
- Merge pull request 'update ui and windows support' ([#5](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/5)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/5


### Added 🚀


- Add Windows packaging and Docker image creation support
- Improve UI cursor interactions and responsiveness


### Fixed 🔧


- Fix test
- Improve Windows path handling in TAK server Docker installation


### Other 📦


- Add FETCH_HEAD file for Git repository management
- Enhance version update script and Windows packaging support
- Update packaging scripts with version environment variable support
- Streamline npm scripts and add setup scripts for Mac and Windows
- Update setup scripts and package version

### Other 📦


- Merge pull request 'docker' ([#1](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/1)) from docker into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/1
- Merge pull request 'Add wrapper submodule' ([#2](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/2)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/2
- Merge pull request 'Add packaging' ([#3](https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/issues/3)) from dev into main

Reviewed-on: https://gitea.local.ubuntuserver.buzz/Jake/Tak-Manager/pulls/3


### Added 🚀


- Enhance ATAK preferences management with custom settings support


### Documentation 📦


- Update README with detailed production deployment instructions
- Simplify README installation instructions
- Update README with refined project structure and environment configuration


### Other 📦


- Bump version to 1.0.0
- Update project configuration and version management scripts
- Remove Electron-related files and configurations
- Remove Tauri-related workspace and scripts
- Update .env.example with improved configuration and comments
- Add tak-manager-wrapper submodule
- Update workspace configuration and dependencies
- Mark tak-manager-wrapper submodule as dirty
- Update project configuration and Docker image build path
- Update .env.example for production deployment
- Update version scripts and Mac-specific packaging
- Remove .env.prod.example file

## [1.0.0] - 2025-01-25

### Added 🚀
- Add readme.txt
- Add launch tak webui button
- Add Docker status monitoring to TAKServer management; implement Docker connection handling and UI updates for installation status
- Add TAK Server uninstallation functionality; implement new SocketIO namespace for uninstallation, update Popup and TakServerStatus components for uninstall progress tracking and UI enhancements
- Add OTA update functionality and enhance UI for configuration process

### Updated 🔄
- Updated frontend to use React
- Update to requirements
- Update directory
- Update TAKServer management with new status monitoring and installation enhancements; bump MUI dependencies to version 6.1.10
- Enhanced Popup components and added uninstall confirmation in TAKServer management; implement blur effect for sidebars and improve UI responsiveness
- Enhanced development setup and Popup component; clear dist directory before build, improve button UI and functionality in Popup for installation status, and refine TakServerStatus for better handling of installation and uninstallation processes.
- Enhanced TakServerStatus component with improved button functionality and UI; add Restart and Launch Admin Page buttons for better user interaction during server operations. Update button states based on server status to provide clearer feedback to users.
- Enhanced the AdvancedFeatures component to manage OTA updates, including file upload, progress tracking, and error handling.
- Enhanced installation progress popups to differentiate between OTA configuration and plugin updates, providing clearer user notifications.
- Updated the backend to handle OTA update requests and emit status updates via SocketIO.
- Updated the CreateCertificates component to support batch generation and individual certificate creation with improved state management and user feedback.
- Updated the ExistingCertificates component to allow for searching, selecting, and deleting certificates, improving user interaction.
- Updated the DataPackage component to include navigation on status check completion; modify check status script in backend
- Updated the import statement for the certmanager_routes to certmanager_bp for consistency with naming conventions.
- Updated the DockerPopup component to handle Docker installation and running states more effectively, improving user interaction.
- Updated the AdvancedFeatures component to utilize the new useOtaSocket hook for improved socket management and event handling.

### Refactored 🔧
- Refactored Popup component to integrate terminal functionality; remove TerminalPopup component. Enhance UI with terminal-specific props, scrolling behavior, and dynamic button rendering based on operation status. Update TakServerStatus to utilize the new Popup structure for installation progress and Docker status notifications.
- Refactored the CertManager page to streamline the certificate management process and remove unnecessary state management, focusing on a cleaner user experience.
- Refactored the DataPackage class to utilize a new operation handling mechanism, allowing for better user feedback during long-running operations.
- Refactored the DataPackage component to manage socket connections and handle operation status updates, enhancing user experience during data package generation.
- Refactored the Services component for improved socket connection handling and state management.
- Refactored the InputField component to streamline its functionality and improve styling consistency.
- Refactored the AdvancedFeatures component for improved UI and functionality, including updated borders, padding, and shadow effects for better visual hierarchy.
- Refactored the DataPackage component to integrate new sections for zip name and CoT streams, providing a more organized layout and better user guidance.
- Refactored the CreateCertificates and ExistingCertificates components to utilize new hooks and loading states, enhancing user experience during operations.

### Removed 🗑️
- Removed the Installers page and related references from the application; update routing and sidebar components accordingly.
- Removed unused state variables in CreateCertificates and ExistingCertificates components to streamline state management.
- Removed the DockerInstallerNamespace class and its associated socket events from socketio.py, streamlining the codebase.
- Removed the old InputField component and replaced it with a new Input component that supports additional props and improved functionality.

### Fixed 🔧
- Fixed scrollbar and updated takserver management page
