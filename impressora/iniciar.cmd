@echo off
rem Mantem o agente de impressao rodando: se ele parar, volta em 10 s. Log em impressao.log (mesma pasta).
rem Inicio automatico com o Windows: veja docs/IMPRESSORA.md (Agendador de Tarefas).
cd /d "%~dp0"
:loop
node --env-file=.env agente-impressao.mjs >> impressao.log 2>&1
timeout /t 10 /nobreak > nul
goto loop
