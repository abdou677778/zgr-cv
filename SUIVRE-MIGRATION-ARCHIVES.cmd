@echo off
setlocal
chcp 65001 >nul
title ZGR - Suivi migration des archives

set "ZGR_ROOT=%~dp0"
where pwsh.exe >nul 2>&1
if %errorlevel% equ 0 (
  pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ZGR_ROOT%scripts\watch-archive-migration.ps1"
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ZGR_ROOT%scripts\watch-archive-migration.ps1"
)

if errorlevel 1 (
  echo.
  echo Le suivi a rencontre une erreur. Consultez le message ci-dessus.
  pause
)
endlocal
