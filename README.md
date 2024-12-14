# Tak-Manager

A full-stack application with a Flask backend and React frontend for managing and monitoring system resources.

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- npm or yarn
- Virtual environment tool (python -m venv)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Tak-Manager
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Install Node.js dependencies
npm install
```

## Running the Application

### Development Mode

1. Start the backend server:
```bash
python run_dev.py
```

2. In a new terminal, start the frontend development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Run the production server:
```bash
./run.sh
```

The application will be available at http://localhost:5000

## Project Structure

- `/backend` - Flask backend code
- `/src` - React frontend source code
- `/dist` - Production build output
- `app.py` - Main Flask application
- `run_dev.py` - Development server script
- `run.sh` - Production server script

## Development Scripts

- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run storybook` - Start Storybook for component development
- `python run_dev.py` - Start backend development server

## Technologies Used

### Backend
- Flask
- Flask-SocketIO
- Python WebView
- Various system monitoring libraries

### Frontend
- React
- Vite
- Tailwind CSS
- Chart.js
- Material-UI
- Shadcn UI
- Socket.IO Client

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

ISC License 