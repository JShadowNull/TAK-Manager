# TAK Manager
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-F7941E?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white)](https://ko-fi.com/jakeolsen)

A comprehensive TAK Server management solution providing a modern web interface for managing and monitoring TAK (Team Awareness Kit) servers.

<img width="1412" alt="image" src="https://github.com/user-attachments/assets/43e23409-59b8-4049-b34f-9ca388c6e582" />

## Quick Start

### Download and Install

#### macOS
1. Download the latest DMG installer from the [releases page](https://github.com/JShadowNull/TAK-Manager/releases/latest)
2. Open the DMG file
3. Drag the TAK Manager application to your Applications folder
4. Open TAK Manager from your Applications folder

#### Windows
1. Download the latest EXE installer from the [releases page](https://github.com/JShadowNull/TAK-Manager/releases/latest)
2. Run the installer
3. Follow the installation wizard
4. Launch TAK Manager from the Start menu

#### Linux
For Linux, manual installation is required:

1. Clone the repository:
```bash
git clone https://github.com/JShadowNull/TAK-Manager.git
cd TAK-Manager
```

2. Create environment file:
```bash
cp .env.example .env
```
Edit the `.env` file with your specific configuration.

3. Build the Docker image with the correct tag:
```bash
docker build -f DockerfileProd -t tak-manager:<version> .
```

4. Start the Docker container:
```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

The application will be available at `http://localhost:8989` (or your configured port).

To stop the container:
```bash
docker compose -f docker-compose.prod.yml down
```

Ensure the Docker build tag matches the tag in `docker-compose.prod.yml`.

## Features

- Modern web-based interface built with React and TypeScript
- Real-time system monitoring (CPU, RAM, and Network usage)
- Responsive design with a beautiful UI using Tailwind CSS and Shadcn UI
- Advanced TAK Server management features:
  - One-click TAK Server installation
  - One-click OTA Plugin configuration
  - Start, stop, and restart TAK Server
  - Certificate management and configuration
  - Data Package management
  - ATAK preferences configuration
  - Advanced logging configuration
  - CoreConfig Editor

## System Requirements

- **macOS**: macOS 11 (Big Sur) or later
- **Windows**: Windows 10 or later
- **Linux**: Any modern Linux distribution with Docker support

## Configuration

After installation, configure TAK Manager to connect to your TAK Server:

1. Launch TAK Manager
2. Install Docker if not already installed
3. Enter your TAK Manager details:
   - TAK Server installation directory
   - Backend API port

## For Developers

If you're interested in developing or contributing to TAK Manager, please see the [Development README](README.DEV.md) for detailed instructions.

## Environment Variables

Key environment variables that can be configured:

- `MODE`: Production
- `BACKEND_PORT`: Backend API port
- `TAK_SERVER_INSTALL_DIR`: TAK Server installation directory on host machine

See `.env.example` for all available options.

## Author

Jacob Olsen

