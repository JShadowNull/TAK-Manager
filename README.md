# TAK Manager

A comprehensive TAK Server management solution that provides a modern web interface for managing and monitoring TAK (Team Awareness Kit) servers.

## Features

- Modern web-based interface built with React and TypeScript
- Real-time system monitoring (CPU, RAM usage)
- Service management capabilities
- Docker-ready deployment with health checks
- Responsive design with a beautiful UI using Tailwind CSS and Shadcn UI
- Built with security and performance in mind
- Progressive Web App (PWA) support for mobile devices
- Dark/Light mode support
- Advanced TAK Server management features:
  - Certificate management and configuration
  - Data Package management
  - ATAK preferences configuration
  - File sharing configuration
  - Team color management
  - Logging configuration
- Real-time monitoring and alerts
- Docker container management
- Secure environment configuration

## Tech Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Chart.js for data visualization
- Vite for build tooling

### Backend
- Python 3.11
- FastAPI
- Docker support
- SSE (Server-Sent Events) for real-time updates

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose (for containerized deployment)
- Python 3.11 or higher (for local development)

## Getting Started

### Development Setup

1. Clone the repository:
```bash
git clone https://gitea.ubuntuserver.buzz/Jake/Tak-Manager.git
cd Tak-Manager
```

2. Create environment file:
```bash
cp .env.example .env.dev
```
Edit the `.env.dev` file with your specific configuration.

3. Start the development environment:
```bash
npm run dev
```

### Production Deployment

1. Create production environment file:
```bash
cp .env.prod.example .env
```
Edit the `.env` file with your specific configuration.

2. Build the production Docker image:
```bash
npm run docker:image
```
This will create a compressed image file in the `dist` directory.

3. Load the Docker image:
```bash
docker load < dist/tak-manager-*.tar.gz
```

4. Start the production container:
```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

The application will be available at `http://localhost:8989` (or your configured port).

To stop the production container:
```bash
docker compose -f docker-compose.prod.yml down
```

## Project Structure

```
tak-manager/
├── client/                     # Frontend React application
├── server/                     # Backend FastAPI application
├── dist/                       
│   └── tak-manager-*.tar.gz    # Production Docker image
├── docker-compose.dev.yml      # Docker compose configuration
├── docker-compose.prod.yml     # Production Docker compose configuration
├── DockerfileProd              # Production Docker configuration
├── DockerfileDev               # Development Docker configuration
├── .env.dev                    # Development environment variables
└── .env                        # Production environment variables
```

## Environment Variables

Key environment variables that need to be configured:

- `MODE`: Application mode (development/production)
- `FRONTEND_PORT`: Frontend application port for development
- `BACKEND_PORT`: Backend API port
- `TAK_SERVER_INSTALL_DIR`: TAK Server installation directory on host machine
- `RESTART_POLICY`: Docker container restart policy
- See `.env.example` for all available options

## Author

Jacob Olsen

## License

ISC License 