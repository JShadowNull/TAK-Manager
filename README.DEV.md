# TAK Manager - Development Guide

This document provides detailed instructions for developers who want to contribute to or modify the TAK Manager application.

## Tech Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Chart.js for data visualization
- Vite for build tooling

### Backend
- Python 3.13.2
- FastAPI
- Docker support
- SSE (Server-Sent Events) for real-time updates
- Poetry for python dependency management

## Prerequisites

- Docker and Docker Compose
- Create-dmg (for macOS DMG installers)
- Inno Setup (for Windows EXE installers)

## Development Setup

### 1. Clone the repository:
```bash
git clone https://github.com/JShadowNull/TAK-Manager.git
cd Tak-Manager
```

### 2. Run the setup script:
Before starting the development environment, run the setup script to configure your environment and install dependencies:
```bash
python dev_scripts/setup_project.py
```
This script will:
- Check for necessary system dependencies (like Docker and Docker Compose).
- Create a `.env` file from `.env.example` and set required environment variables.
- Install npm and Python dependencies.

### 3. Start the development environment:
```bash
npm run dev
```
This will start the Docker development environment with hot reloading enabled.

### 4. For wrapper development (Pywebview app):
```bash
npm run docker:image-mac # or npm run docker:image-win
```

```bash
npm run wrapper:dev
```
This will start the Pywebview development environment with hot reloading for the wrapper but docker app will need to be built again upon changes.
## Building Packages

**Important Note:** Ensure that the root `.env` file is configured for production mode before deploying the application. This includes setting the `MODE` variable to `production` and verifying that all necessary environment variables are correctly defined.

### Building for macOS:

```bash
npm run docker:image-mac
```

```bash
npm run package:mac
```
This will create a DMG installer in the `TAK-Wrapper/dist` directory.

### Building for Windows:
```bash
npm run docker:image-win
```

```bash
npm run package:win
```
This will create an EXE installer in the `TAK-Wrapper/dist` directory.

## Project Structure

```
tak-manager/
├── client/                         
├── server/                         
├── TAK-Wrapper/           
│   └── docker/                         
│       └── tak-manager-*.tar.gz   
│   └── dist/    
│       └── TAK Manager <version>.exe or TAK Manager <version>.dmg               
├── docker-compose.yml             
├── Dockerfile                 
├── .env.example
└── .env                           
```

## Environment Variables

Key environment variables that need to be configured:

- `MODE`: Application mode (development/production)
- `FRONTEND_PORT`: Frontend application port for development
- `BACKEND_PORT`: Backend API port
- `TAK_SERVER_INSTALL_DIR`: TAK Server installation directory on host machine
- `RESTART_POLICY`: Docker container restart policy
- See `.env.example` for all available options

## Release Process

To create a new release:

```bash
npm run release
```

This will:
- Update the version number across the application