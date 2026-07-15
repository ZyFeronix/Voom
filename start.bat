:: start.bat
@echo off
cd frontend
if not exist "node_modules\" (
    echo Instalando dependencias de Node.js...
    npm install
)
echo Iniciando servidor de desarrollo en puerto 3000...
npm run dev -- --port 3000 --host
