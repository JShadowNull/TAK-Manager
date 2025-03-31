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

## Prerequisites

- Docker and Docker Compose
- Create-dmg (for macOS DMG installers)
- Inno Setup (for Windows EXE installers)

## Development Setup

### 1. Clone the repository:
```bash
git clone https://gitea.ubuntuserver.buzz/Jake/Tak-Manager.git
cd Tak-Manager
```

### 2. Create environment file:
```bash
cp .env.example .env.dev
```
Edit the `.env.dev` file with your specific configuration.

### 4. Start the development environment:
```bash
npm run dev
```

This will start the Docker development environment with hot reloading enabled.

### 5. For wrapper development (Pywebview app):
```bash
npm run docker:image-mac # or npm run docker:image-win
```

```bash
npm run wrapper:dev
```

This will start the Pywebview development environment with hot reloading for the wrapper but docker app will need to be built again upon changes.
## Building Packages

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
├── docker-compose.dev.yml             
├── docker-compose.prod.yml        
├── DockerfileProd                 
├── DockerfileDev                  
├── .env.dev
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
1. Update the version number
2. Merge the dev branch into main
3. Create a new release tag
4. Update the changelog