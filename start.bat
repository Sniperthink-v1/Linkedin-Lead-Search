@echo off
echo Starting LinkedIn Lead Search Application...
echo.

REM Check if .env exists
if not exist "server\.env" (
    echo ERROR: server\.env file not found!
    echo Please create server\.env and add your SERPER_API_KEY
    pause
    exit /b 1
)

REM Start LinkedIn server
echo Starting LinkedIn Search Server on port 3000...
start "LinkedIn Server" cmd /k "cd server && node server-serper-linkedin.js"
timeout /t 2 /nobreak >nul

REM Start Business server
echo Starting Business Search Server on port 3001...
start "Business Server" cmd /k "cd server && node server-serper-business.js"
timeout /t 2 /nobreak >nul

REM Start frontend
echo Starting React Frontend...
start "Frontend" cmd /k "cd client && npm run dev"

echo.
echo All servers started!
echo.
echo LinkedIn Server: http://localhost:3000
echo Business Server: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window (servers will keep running)
pause >nul
