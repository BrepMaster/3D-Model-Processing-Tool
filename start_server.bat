@echo off
title 3D Model Tool Server (mvcnn)

echo.
echo ==============================================
echo          3D Model Tool Launcher (mvcnn)
echo ==============================================
echo.

echo [Cleanup] Checking and killing processes on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo   Killing PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [Start] Activating mfcad environment and starting server...
echo   [Tip] Press Ctrl+C to safely stop the server
echo.

call conda activate mvcnn
if %errorlevel% neq 0 (
    echo Error: Failed to activate mfcad environment
    pause
    exit /b 1
)

python app.py

echo.
echo [OK] Server stopped
pause