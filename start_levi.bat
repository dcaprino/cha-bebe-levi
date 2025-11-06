@echo off
title Chá de Bebê do Levi - Execução Completa
color 0B
cd /d "S:\Cha_Bebe_Levi"

echo ============================================================
echo      CHÁ DE BEBÊ DO LEVI - INICIALIZANDO SISTEMA LOCAL
echo ============================================================
echo.

echo [1/5] Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale o Node e tente novamente.
  pause
  exit /b
)
echo OK - Node.js detectado.
echo.

echo [2/5] Instalando dependencias...
if exist package.json (
  call npm install >nul 2>&1
  echo Dependencias instaladas.
) else (
  echo Nenhum package.json encontrado. Pulando esta etapa.
)
echo.

echo [3/5] Verificando banco de dados...
if not exist db mkdir db
if not exist db\rifa.db (
  echo Criando banco SQLite inicial...
  node -e "require('better-sqlite3')('./db/rifa.db'); console.log('Banco criado.');"
) else (
  echo Banco existente.
)
echo.

echo [4/5] Iniciando servidor Node e WhatsApp...
echo ------------------------------------------------------------
echo Deixe este terminal aberto.
echo O QR Code do WhatsApp aparecera aqui no console.
echo ------------------------------------------------------------
echo.

REM Inicia o servidor em um novo terminal e monitora logs
start "Servidor Chá Levi" cmd /k "cd /d S:\Cha_Bebe_Levi && node server.js"

REM Aguarda o servidor subir antes de abrir o navegador
echo Aguardando servidor iniciar...
timeout /t 8 >nul

echo [5/5] Abrindo site local...
start "" "http://localhost:3026"

echo.
echo ============================================================
echo Tudo pronto! Sistema rodando em: http://localhost:3026
echo ============================================================
pause
exit
