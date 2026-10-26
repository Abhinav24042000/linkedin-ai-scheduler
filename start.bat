@echo off
TITLE LinkedIn Post Scheduler - Autonomous AI Engine
COLOR 0A

:: Ensure current working directory is the script folder
cd /d "%~dp0"

echo ======================================================================
echo           LINKEDIN POST SCHEDULER ^& AI CAMPAIGN ENGINE
echo ======================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your PATH.
    echo Please install Node.js v18 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] Verifying Node.js environment...
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo       Node.js version: %NODE_VERSION%

:: Check dependencies
echo.
echo [2/3] Checking project dependencies...
if not exist "node_modules\" (
    echo       Root dependencies missing. Running npm install...
    call npm install
)
if not exist "server\node_modules\" (
    echo       Server dependencies missing. Installing...
    cd server
    call npm install
    cd /d "%~dp0"
)
if not exist "client\node_modules\" (
    echo       Client dependencies missing. Installing...
    cd client
    call npm install
    cd /d "%~dp0"
)
echo       All dependencies are installed and up to date.

:: Start application and open browser
echo.
echo [3/3] Starting LinkedIn Scheduler (Backend: :3001, Frontend: :5173)...
echo.
echo       - Server running at: http://localhost:3001
echo       - Web App running at: http://localhost:5173
echo.
echo Launching default browser to http://localhost:5173 in 3 seconds...

:: Open browser after 3 seconds in background
start "" /b cmd /c "ping 127.0.0.1 -n 4 >nul & start http://localhost:5173"

echo.
echo ======================================================================
echo Application is running! Press Ctrl+C in this window to stop both servers.
echo ======================================================================
echo.

call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Application stopped with an error code: %ERRORLEVEL%
)

pause
