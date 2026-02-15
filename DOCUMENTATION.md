# Fitness App Documentation

## Overview
A web-based fitness application for tracking workouts, exercises, and user progress. Built with React (Vite) and FastAPI (Python).

## Setup
### Prerequisites
- Node.js & npm
- Python 3.8+

### Installation
1.  **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd fitness-app
    ```
2.  **Backend Setup**:
    ```bash
    python -m venv venv
    venv\Scripts\activate # Windows
    # source venv/bin/activate # Linux/Mac
    pip install -r backend/requirements.txt
    ```
3.  **Frontend Setup**:
    ```bash
    npm install
    ```

### Running the Application
1.  **Start Backend**:
    ```bash
    uvicorn backend.main:app --reload
    ```
2.  **Start Frontend**:
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

## Features
- **User Authentication**: Sign up and login with email/password.
- **Dashboard**: View workout history and stats.
- **Training**:
    - Select from default exercises or create custom ones.
    - Track sets, reps, and weight.
    - **Active Session**: Timer runs during workout.
    - **Rest Timer**: Automatically tracks rest time between sets.
- **Profile**:
    - Export data to JSON.
    - manage account settings.

## Project Structure
- `backend/`: FastAPI application, database models, and API routers.
- `src/`: React frontend source code.
    - `components/`: Reusable UI components.
    - `context/`: React Context for state management (`DataContext`, `WorkoutContext`).
    - `pages/`: Application pages (`Dashboard`, `Link`, `Profile`, `training/`).
    - `api/`: API client configuration.
