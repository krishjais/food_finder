@echo off
title BHOOK Launcher
echo ==============================================
echo       Starting BHOOK Food Aggregator
echo ==============================================
echo.

echo [1/2] Launching Backend on http://localhost:5000 ...
start "BHOOK Backend (Port 5000)" cmd /k "cd /d %~dp0food-finder && npm run dev"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo [2/2] Launching Frontend on http://localhost:5173 ...
start "BHOOK Frontend (Port 5173)" cmd /k "cd /d %~dp0bhook-frontend && npm run dev"

echo Waiting for frontend to start...
timeout /t 2 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo Both servers are now running!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
