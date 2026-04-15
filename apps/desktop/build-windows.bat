@echo off
setlocal

REM Build Windows installer and portable binary for desktop app
pnpm build
if errorlevel 1 exit /b %errorlevel%

pnpm build:main
if errorlevel 1 exit /b %errorlevel%

pnpm exec electron-builder --config electron-builder.yml --win
if errorlevel 1 exit /b %errorlevel%

echo.
echo Windows build completed. Artifacts are in apps\desktop\release

