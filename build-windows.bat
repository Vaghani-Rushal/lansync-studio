@echo off
setlocal

REM Build Windows artifacts for @pcconnector/desktop from workspace root
pnpm --filter @pcconnector/desktop dist:win
if errorlevel 1 exit /b %errorlevel%

echo.
echo Windows build completed. Artifacts are in apps\desktop\release

