@echo off
echo Starting TrimTube Backend Server...
cd %~dp0
call .\venv\Scripts\activate.bat
python main.py
pause
