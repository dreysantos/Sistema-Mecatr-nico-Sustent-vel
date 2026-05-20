@echo off
cd /d "%~dp0"
set MODO_CLOUD=true
set PORTA_SITE=3000
echo Iniciando site em modo cloud...
echo Acesse: http://localhost:3000
echo.
npm.cmd start
pause
