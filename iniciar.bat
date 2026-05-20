@echo off
REM Script para iniciar o servidor e exibir URL de acesso

cls
echo.
echo ======================================
echo    Sistema Mecatronico Automatizado
echo ======================================
echo.

REM Verificar se node_modules existe
if not exist node_modules (
    echo [*] Instalando dependencias...
    call npm install
    echo.
)

REM Iniciar servidor
echo [+] Iniciando servidor...
echo.
npm start

pause
