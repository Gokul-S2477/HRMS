@echo off
echo ===================================================
echo Starting SmartHR Project...
echo ===================================================

echo Starting Backend Server (Uvicorn on port 8000)...
start cmd /k "cd backend && python -m uvicorn backend.asgi:application --port 8000 --reload"

echo Starting Frontend Server (React on port 3000)...
start cmd /k "cd frontend && npm start"

echo ===================================================
echo Both servers have been launched in separate windows!
echo - Backend: http://127.0.0.1:8000
echo - Frontend: http://localhost:3000
echo ===================================================
pause
