@echo off
setlocal

if "%1"=="run" goto :run
if "%1"=="setup" goto :setup

echo TrimTube CLI
echo.
echo Usage:
echo   ttyt run     - Start both backend and frontend
echo   ttyt setup   - Install dependencies for both
exit /b 1

:run
echo.
echo Starting TrimTube Servers...
echo [1/2] Starting Backend Server...
cd /d "%~dp0backend"
start "TrimTube Backend" /min cmd /c "call venv\Scripts\activate.bat && python main.py"

echo [2/2] Starting Frontend Server...
cd /d "%~dp0frontend"
start "TrimTube Frontend" /min cmd /c "npm run dev"

echo.
echo ==========================================
echo  TrimTube Clone is running!
echo ==========================================
echo  - Backend:  http://localhost:8001
echo  - Frontend: http://localhost:5173
echo.
echo  Check the minimized windows for logs.
echo  Press any key to exit this CLI (servers will keep running).
echo ==========================================
pause
exit /b 0

:setup
echo.
echo Setting up TrimTube Clone...

echo [1/2] Setting up Backend...
cd /d "%~dp0backend"
if not exist venv python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo [2/2] Setting up Frontend...
cd /d "%~dp0frontend"
call npm install

echo.
echo Setup Complete!
echo Use "ttyt run" to start the project.
exit /b 0
