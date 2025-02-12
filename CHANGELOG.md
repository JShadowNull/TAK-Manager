# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add changelog tracking
- Add option to hide input number arrows
- Add number input with custom controls and styling
- Add ability to download certificates
- Add FETCH_HEAD file for Git repository management
- Add Windows packaging and Docker image creation support
- Add tak-manager-wrapper submodule

### Changed

- Enhance changelog generation and configuration
- Update changelog and add new npm script for changelog generation
- Update tak-manager-wrapper submodule to latest commit
- Update tak-manager-wrapper submodule
- Bump version to 1.0.2 and update changelog
- Enhance file input with drag-and-drop and custom styling
- Update setup scripts and package version
- Improve UI cursor interactions and responsiveness
- Streamline npm scripts and add setup scripts for Mac and Windows
- Update packaging scripts with version environment variable support
- Enhance version update script and Windows packaging support
- Delete FETCH_HEAD
- Mark tak-manager-wrapper submodule as dirty
- Update version scripts and Mac-specific packaging
- Update .env.example for production deployment
- Update project configuration and Docker image build path
- Mark tak-manager-wrapper submodule as dirty
- Update workspace configuration and dependencies
- Update README with refined project structure and environment configuration
- Simplify README installation instructions
- Update README with detailed production deployment instructions
- Update .env.example with improved configuration and comments
- Enhance ATAK preferences management with custom settings support

### Fixed

- Improve Windows path handling in TAK server Docker installation

### Removed

- Remove default browser scroll
- Remove .env.prod.example file
- Remove Tauri-related workspace and scripts
- Remove Electron-related files and configurations

## [1.0.0] - 2025-01-25

### Changed

- Update project configuration and version management scripts
- Bump version to 1.0.0

## [1.0.2] - 2025-01-25

### Added

- Add launch tak webui button
- Add Certificate Manager functionality and enhance UI components
- Add Certificate Manager route and update Sidebar and TitleBar components
- Add FontAwesome icons and enhance Services component UI
- Add OTA update functionality and enhance UI for configuration process
- Add TAK Server uninstallation functionality; implement new SocketIO namespace for uninstallation, update Popup and TakServerStatus components for uninstall progress tracking and UI enhancements
- Add Docker status monitoring to TAKServer management; implement Docker connection handling and UI updates for installation status
- Add readme.txt

### Changed

- Bump version to 1.0.2
- Refactor project configuration and deployment settings for production environment
- Refactor and enhance certificate management components for improved functionality and user experience
- Enhance application structure and functionality with PWA support and improved error handling
- Refactor ContainerStartStopButton component by removing unused icon import
- Update Configuration component to navigate to Cert Manager on button click
- Refactor application structure by removing Transfer component and related routes
- Refactor certificate management components for improved functionality and UI
- Refactor Tooltip component to improve type definitions and enhance code clarity
- Update DataPackage component styling to use 'bg-card' class for improved UI consistency
- Working certificate manager
- Improve error handling in TakServerProvider by adding error logging for server status errors
- Working datapackage config
- Enhance Docker and client configurations with updated dependencies and UI improvements
- Enhance OTA update and configuration processes with improved progress tracking and error handling
- Refactor OTA configuration and update processes with improved UI components and status handling
- Update takserver install status to display thoughout entire app and be passed down to child components
- Organize file structure
- Rename tak operation popups
- Update web access dir to work in docker. removed loading state from install & uninstall buttons
- Takserver control buttons working
- Working dashboard, takserver install/uninstall
- Refactor application structure, enhance configuration, and improve UI components
- Enhance logging, Docker configuration, and file watching functionality
- Refactor client configuration and update dependencies for improved functionality
- Update service worker and OTA routes for improved functionality
- Update client/src/pages/Dashboard.jsx
- Refactor UI components for improved layout and responsiveness
- Enhance Docker configuration, update dependencies, and improve UI responsiveness
- Refactor environment handling and enhance Docker configuration
- Enhance Docker and monitoring functionality
- Refactor application structure and remove Services page
- Update .gitignore, refactor package.json and tailwind.config.js, and remove unused story files
- Docker sockets and apis working
- Update pip requirements
- Update .gitignore, refactor Vite config, and enhance logging in app_dev.py
- Directory restructure
- Init
- Refactor logging configuration and static file serving logic
- Enhance certificate management functionality and improve operation tracking
- Refactor certificate manager route import in create_app function
- Refactor Popup component to streamline props and enhance usability
- Enhance OTA update process with improved operation status tracking and error handling
- Refactor AdvancedFeatures component for improved UI and functionality
- Enhance package management and UI components
- Refactor DockerPopup and TakServerStatus components for improved functionality and user experience
- Refactor Services component to streamline loading execution
- Refactor component imports and remove deprecated files
- Refactor certificate management components and update sidebar imports
- Refactor Button component and update imports across the application
- Enhance TAK Server installation and uninstallation processes with improved operation status tracking
- Integrate OperationStatus helper into takserver_routes for enhanced operation feedback
- Refactor InputField usage across certificate management components
- Enhance TAK Server installation and rollback processes with improved operation status handling
- Refactor InputField component and update TakServerStatus to use new Input implementation
- Refactor InputField and TakServerStatus components for improved styling and functionality
- Refactor LoadingButton component and remove LoadingSpinner icon
- Enhance Docker and TAK Server management with improved operation status handling
- Refactor DockerPopup component to remove unused imports
- Enhance Docker and TAK Server management with improved initial state handling and socket events
- Refactor Docker management and enhance operation status handling
- Refactor CardTitle and AnalyticsChart components for improved styling
- Enhance Button component with type support and refactor for clarity
- Refactor socketio.py to remove unused imports and streamline code
- Refactor Docker installation handling and update namespaces for improved organization
- Enhance DockerManager functionality and improve operation status handling
- Refactor TAK Server status handling and enhance UI feedback
- Enhance TAK Server management and UI components for improved functionality
- Enhance Docker management and refactor related components for improved functionality
- Integrate ThemeProvider and enhance AppSidebar with ModeToggle
- Enhance UI components and update dependencies for improved functionality
- Refactor UI components to standardize border styles and enhance consistency
- Update dependencies, enhance UI components, and refactor layout structure
- Refactor import paths and remove obsolete hooks for improved organization
- Refactor component structure and enhance UI consistency
- Refactor logging, enhance network monitoring, and update UI components
- Enhance logging configuration and refactor Socket.IO namespaces
- Enhance development environment setup and Socket.IO integration
- Refactor data package handling and enhance Socket.IO integration
- Refactor certificate management and enhance Socket.IO integration
- Refactor tooltip and button components for improved functionality and integration
- Implement OTA update and installation functionality with Socket.IO integration
- Refactor Takserver component to simplify start/stop handling
- Refactor TAK Server management and enhance Socket.IO integration
- Enhance Button component functionality and integrate loading states
- Update Docker management functionality and enhance socket communication
- Refactor data package operation handling and enhance socket communication
- Refactor Popup component and update styles for improved button integration
- Refactor app.py and backend structure for improved functionality and logging
- Refactor AdbInstallation component to improve button integration and styling
- Refactor FileList component to simplify styling
- Update requirements.txt to include new dependencies for enhanced functionality
- Update dependencies, enhance button components, and improve Tailwind configuration
- Update dependencies, enhance button styles, and improve transfer components
- Enhance Storybook integration and improve Transfer component functionality
- Enhance Storybook integration and improve transfer functionality
- Update dependencies, enhance PostCSS configuration, and improve Tailwind setup
- Refactor transfer routes and enhance file transfer functionality
- Refactor socket handling and enhance DataPackage component for improved user experience
- Refactor UI components in DataPackage for improved layout and functionality
- Enhance DataPackage component and related functionalities for improved certificate handling and user experience
- Implement preference normalization and validation for CoT streams in DataPackage
- Enhance CreateCertificates component to support multiple groups for certificates
- Refactor CertManager's delete_user_certificates method for improved container verification and file deletion
- Enhance CreateCertificates and ExistingCertificates components with improved UI and functionality
- Update package dependencies and enhance ExistingCertificates component with MUI integration
- Refactor system monitoring and IP fetching functionality; enhance certificate management UI
- Update DataPackage component to include navigation on status check completion; modify check status script in backend
- Enhance Sidebar component with TAK Server status monitoring and dynamic navigation
- Refactor Data Package handling and enhance UI for Docker and TAK Server status checks
- Refactor Data Package routes and components for improved preference management and UI enhancements
- Refactor Services component for improved socket connection handling and state management
- Enhance AdvancedFeatures component with plugin update functionality and UI improvements
- Enhance TakServerStatus component with improved button functionality and UI; add Restart and Launch Admin Page buttons for better user interaction during server operations. Update button states based on server status to provide clearer feedback to users.
- Enhance development setup and Popup component; clear dist directory before build, improve button UI and functionality in Popup for installation status, and refine TakServerStatus for better handling of installation and uninstallation processes.
- Refactor Popup component to integrate terminal functionality; remove TerminalPopup component. Enhance UI with terminal-specific props, scrolling behavior, and dynamic button rendering based on operation status. Update TakServerStatus to utilize the new Popup structure for installation progress and Docker status notifications.
- Enhance Popup components and add uninstall confirmation in TAKServer management; implement blur effect for sidebars and improve UI responsiveness
- Update TAKServer management with new status monitoring and installation enhancements; bump MUI dependencies to version 6.1.10
- Updated frontend to use react
- Update directory
- Update to requirements
- V1.0.0

### Fixed

- Fixed scrollbar and updated takserver management page

### Removed

- Remove installer guide and related macOS deployment scripts
- Remove unnecessary console logging in CreateCertificates and ExistingCertificates components to streamline error handling and improve code clarity. This change enhances the maintainability of the certificate management features by focusing on essential error messages and reducing clutter in the codebase.
- Remove unused state
- Remove old sse file
- Remove architecture, conversion, and script update documentation files
- Remove vite.config.js and update tsconfig.node.json for project cleanup
- Remove unused compiled Python files and update DataPackage component
- Remove unused CSS and JavaScript files to streamline the frontend codebase
- Remove unused components and refactor InputField and PreferenceItem for improved structure
- Remove Installers page and related references from the application; update routing and sidebar components accordingly.

[unreleased]: https://gitea.ubuntuserver.buzz/Jake/Tak-Manager.git/compare/1.0.0..HEAD
[1.0.0]: https://gitea.ubuntuserver.buzz/Jake/Tak-Manager.git/compare/v1.0.2..1.0.0

<!-- generated by git-cliff -->
