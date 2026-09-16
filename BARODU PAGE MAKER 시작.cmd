@echo off
chcp 65001 >nul
title BARODU PAGE MAKER
cd /d "%~dp0"
echo.
echo   BARODU PAGE MAKER 를 여는 중입니다...
echo.
node scripts\serve.mjs
if errorlevel 1 pause
