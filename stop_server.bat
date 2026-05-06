@echo off
title Stop Server

echo.
echo ==============================================
echo       Stop 3D Model Tool Server
echo ==============================================
echo.

echo [Search] Finding processes on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo   Found PID: %%a
    echo   Killing...
    taskkill /F /PID %%a >nul 2>&1
    echo   Done with PID %%a
)

echo.
echo [OK] Done!
echo.
pause


