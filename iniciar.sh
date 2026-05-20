#!/bin/bash
# Script para iniciar o servidor no Linux/macOS

clear
echo ""
echo "======================================"
echo "   Sistema Mecatronico Automatizado"
echo "======================================"
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "[*] Instalando dependências..."
    npm install
    echo ""
fi

# Iniciar servidor
echo "[+] Iniciando servidor..."
echo ""
npm start
