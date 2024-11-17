# System Monitor Flask Application

This is a modular Flask-based application that monitors CPU, RAM usage, and running services. It provides a simple interface for viewing system metrics using a Flask backend and a PyWebview frontend. This guide will help you add new functionality and ensure everything is properly configured.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Adding New Python Scripts](#adding-new-python-scripts)
5. [Configuring Routes and Blueprints](#configuring-routes-and-blueprints)
6. [Difference Between `services/` and `routes/`](#difference-between-services-and-routes)
7. [Running the Application](#running-the-application)
8. [Troubleshooting](#troubleshooting)

---

## Project Structure

Here is the complete project structure based on the relevant files:

```
your_project/
├── app.py                    # Entry point for the application
├── backend/                  # Backend logic (routes, services)
│   ├── __init__.py           # Initializes Flask app and registers blueprints
│   ├���─ routes/               # Folder containing route definitions (URLs for API)
│   │   ├── __init__.py
│   │   ├── dashboard_routes.py       # Routes for system monitoring dashboard
│   │   ├── docker_manager_routes.py  # Routes for Docker management
│   │   └── installer_routes.py       # Routes for installer management
│   ├── services/             # Contains system-level service logic (business logic)
│   │   ├── __init__.py
│   │   ├── run_command_helper.py     # Helper for running system commands
│   │   ├── socketio_handler.py       # Socket.IO integration for real-time communication
│   │   └── scripts/          # Additional scripts for Docker and TAK server
│   │       ├── certconfig.py         # Certificate configuration logic
│   │       ├── docker_installer.py   # Docker installation logic
│   │       ├── docker_manager.py     # Docker management logic
│   │       ├── os_detector.py        # OS detection script
│   │       ├── system_monitor.py     # System monitoring logic
│   │       └── takserver_installer.py# TAK server installation logic
├── frontend/                 # Frontend files (HTML, CSS, JS)
│   ├── static/
│   │   ├── css/
│   │   │   └── styles.css
│   │   └── js/
│   │       ├── dashboard.js  # JavaScript for dashboard functionality
│   │       ├── docker.js     # JavaScript for Docker control
│   │       ├── terminal_window.js # JavaScript for terminal output streaming
│   │       └── services.js   # JavaScript for services management
│   └── templates/
│       ├── base.html         # Base HTML template
│       ├── index.html        # Dashboard template
│       ├── installers.html   # Docker installer template
│       └── services.html     # Services management template
├── config.py                 # Configuration settings
├── requirements.txt          # List of required Python packages
├── package.json              # Node.js package configuration
├── tailwind.config.js        # Tailwind CSS configuration
└── README.md                 # Documentation for the project

---

## Prerequisites

Make sure you have the following installed on your system:

- **Python 3.x**: Install the latest version of Python.
- **Pip**: Ensure pip is installed for managing Python packages.
- **Virtual Environment**: Set up a virtual environment to isolate dependencies.

### Installing Dependencies

1. Create a virtual environment:
   ```bash
   python3 -m venv .venv
   ```

2. Activate the virtual environment:
   - On macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```
   - On Windows:
     ```bash
     .venv\Scripts\activate
     ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

---

## Getting Started

1. **Clone the repository** or download the project files.

2. **Set up the virtual environment and install dependencies** as described in the [Prerequisites](#prerequisites) section.

3. **Run the application**:
   ```bash
   python app.py
   ```

---

## Adding New Python Scripts

You can easily add new Python scripts to extend the functionality of the application. Follow these steps:

### Step 1: Add Your Python Script

1. **Determine where your script belongs**:
   - If the script is **business logic** (e.g., fetching system metrics, managing services), it belongs in the `backend/services/` directory.
   - If the script is related to handling **routes** (e.g., responding to API requests for `/cpu` or `/ram`), it belongs in the `backend/routes/` directory.

2. **Place your script in the appropriate folder**:
   - For example, if you're adding a Python script to fetch disk usage, it would go in `backend/services/disk_usage.py`.

   ```bash
   touch backend/services/disk_usage.py
   ```

   Inside `disk_usage.py`, you can write logic to fetch disk usage stats using a library like `psutil`.

   ```python
   import psutil

   def get_disk_usage():
       return psutil.disk_usage('/')
   ```

3. **Define a route to access your script**:
   Once your script is in the `services/` directory, you need to create or update a route in `backend/routes/` that calls your script when an API request is made.

   For example, in `backend/routes/disk_routes.py`:
   ```python
   from flask import Blueprint, jsonify
   from backend.services.disk_usage import get_disk_usage

   disk_bp = Blueprint('disk', __name__)

   @disk_bp.route('/disk')
   def disk_usage():
       usage = get_disk_usage()
       return jsonify({
           'total': usage.total,
           'used': usage.used,
           'free': usage.free,
           'percent': usage.percent
       })
   ```

4. **Register the new route** in the main application file (`backend/__init__.py`) by importing and registering the blueprint.

   In `backend/__init__.py`:
   ```python
   from backend.routes.disk_routes import disk_bp

   def create_app():
       app = Flask(__name__)

       # Register existing blueprints
       app.register_blueprint(monitor_bp)
       app.register_blueprint(service_bp)

       # Register the new disk blueprint
       app.register_blueprint(disk_bp)

       return app
   ```

---

## Configuring Routes and Blueprints

### What Are Routes?

Routes are the URLs that the frontend or API calls to interact with the backend. For example:
- `/cpu` returns the CPU usage.
- `/services` returns a list of running services.

### What Are Blueprints?

Blueprints allow you to organize related routes together in a modular way. Instead of defining all routes in one big file, you can split them into separate files for easier management. For example, you can have a `monitor_routes.py` file that handles all monitoring-related routes, and a `service_routes.py` file that handles routes related to managing services.

Each blueprint is registered with the main Flask app to make its routes accessible.

---

## Difference Between `services/` and `routes/`

### `services/` Directory

- **Purpose**: The `services/` directory is where the **business logic** of your application resides. This means any logic that performs actual system tasks, calculations, or data fetching should be placed here. For example:
  - Fetching CPU or RAM usage.
  - Starting or stopping services.
  - Any processing logic that is unrelated to routing.

- **Examples**:
  - `backend/services/system.py`: Contains functions to start and stop system services.
  - `backend/services/disk_usage.py`: Contains a function to get disk usage.

- **Where Existing Python Scripts Go**: If you have an existing Python script that contains system-related logic (like fetching CPU stats or managing services), it should go in the `services/` directory. This script can then be imported into a route file to be called when needed.

### `routes/` Directory

- **Purpose**: The `routes/` directory contains the **routing logic**. Routes define the endpoints (URLs) that users or the frontend can interact with to trigger the logic in `services/`. Each route corresponds to an HTTP endpoint that responds to GET or POST requests.

- **Examples**:
  - `backend/routes/monitor_routes.py`: Defines routes like `/cpu` and `/ram` that respond to requests for CPU and RAM usage.
  - `backend/routes/service_routes.py`: Defines routes like `/services` to return information about running services.

- **Where to Add Routes**: If you need to expose an existing Python script through the web interface (e.g., `/cpu` for CPU stats), you would add a new route in `routes/`. The route will call the logic defined in `services/`.

---

## Running the Application

1. **Activate the virtual environment**:
   ```bash
   source .venv/bin/activate
   ```

2. **Run the application**:
   ```bash
   python app.py
   ```

3. Open your browser and go to `http://127.0.0.1:5000` to see the running app.

---

## Troubleshooting

- **404 Errors for Routes**:
  - Ensure that your route is defined and that the blueprint is registered in `backend/__init__.py`.

- **Static Files Not Loading**:
  - Ensure that your CSS and JavaScript files are located in the `frontend/static/` directory and that they are referenced correctly in `index.html`.

- **Missing Dependencies**:
  - Make sure all dependencies are installed by running `pip install -r requirements.txt` in your virtual environment.

---

### Author

Jacob Olsen
