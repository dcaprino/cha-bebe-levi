@echo off
REM Script de instalação simples para Windows
echo Instalando dependências...
npm install
if %errorlevel% neq 0 (
  echo Erro ao instalar dependências.
  pause
  exit /b 1
)
echo Dependências instaladas com sucesso.
echo Iniciando servidor...
npm start
pause