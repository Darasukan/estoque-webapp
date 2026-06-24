@echo off
title Estoque - DEV + PROD
cd /d "%~dp0"
call npm run server
if errorlevel 1 pause
