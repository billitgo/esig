@echo off
chcp 65001 >nul
title seal-system launcher
cd /d %~dp0

echo ============================================
echo   seal-system 电子盖章系统 - 一键启动
echo ============================================
echo.

echo [1/2] 启动后端 (http://localhost:3000) ...
start "seal-backend" cmd /k "cd /d %~dp0backend && npm start"

timeout /t 2 /nobreak >nul

echo [2/2] 启动前端 (http://localhost:5173) ...
start "seal-frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo 服务启动中，请稍候 3-5 秒...
echo 浏览器访问: http://localhost:5173
echo.
echo 提示: 关闭时分别关掉两个黑色窗口即可
pause
