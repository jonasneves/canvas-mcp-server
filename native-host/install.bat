@echo off
REM CanvasFlow Native Host Installation Script for Windows

echo CanvasFlow Native Host Installer
echo =================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed
    echo Please install Node.js 14 or higher from https://nodejs.org/
    pause
    exit /b 1
)

node -v
echo.

REM Set installation directory
set "INSTALL_DIR=%APPDATA%\CanvasFlow\native-host"
echo Installation directory: %INSTALL_DIR%
echo.

REM Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy files
echo Copying files...
copy /Y host.js "%INSTALL_DIR%\"
copy /Y manifest.json "%INSTALL_DIR%\"
copy /Y package.json "%INSTALL_DIR%\"
copy /Y package-lock.json "%INSTALL_DIR%\"
copy /Y README.md "%INSTALL_DIR%\"

REM Install dependencies
echo Installing dependencies...
cd /d "%INSTALL_DIR%"
call npm install --production

REM Configure native messaging
echo Configuring native messaging...
set "NATIVE_MANIFEST_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts"
if not exist "%NATIVE_MANIFEST_DIR%" mkdir "%NATIVE_MANIFEST_DIR%"

REM Create manifest with absolute path (escape backslashes for JSON)
set "HOST_PATH=%INSTALL_DIR%\host.js"
set "HOST_PATH=%HOST_PATH:\=\\%"

(
echo {
echo   "name": "com.canvasflow.host",
echo   "description": "CanvasFlow Native Messaging Host",
echo   "path": "%HOST_PATH%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://EXTENSION_ID/"
echo   ]
echo }
) > "%NATIVE_MANIFEST_DIR%\com.canvasflow.host.json"

echo Installed to: %NATIVE_MANIFEST_DIR%\com.canvasflow.host.json
echo.
echo Installation complete!
echo.
echo =================================
echo CHROME EXTENSION ID CONFIGURATION
echo =================================
echo.
echo To complete setup, you need your CanvasFlow extension ID:
echo.
echo   1. Open Chrome and go to: chrome://extensions/
echo   2. Enable 'Developer mode' (top right)
echo   3. Find 'CanvasFlow' in the list
echo   4. Copy the ID (looks like: abcdefghijklmnopqrstuvwxyz123456)
echo.

set /p EXTENSION_ID="Enter your CanvasFlow extension ID (or press Enter to skip): "

if not "%EXTENSION_ID%"=="" (
    REM Replace EXTENSION_ID in the manifest file
    powershell -Command "(Get-Content '%NATIVE_MANIFEST_DIR%\com.canvasflow.host.json') -replace 'EXTENSION_ID', '%EXTENSION_ID%' | Set-Content '%NATIVE_MANIFEST_DIR%\com.canvasflow.host.json'"
    echo.
    echo [92m✓ Extension ID configured successfully![0m
) else (
    echo.
    echo [93m⚠ Skipped extension ID configuration.[0m
    echo.
    echo To configure later, edit this file:
    echo   %NATIVE_MANIFEST_DIR%\com.canvasflow.host.json
    echo.
    echo Replace 'EXTENSION_ID' with your actual extension ID.
)

echo.
echo =================================
echo CLAUDE DESKTOP SETUP
echo =================================
echo.
echo To use this with Claude Desktop, add to your Claude Desktop config:
echo.
echo Location: %%APPDATA%%\Claude\mcp.json
echo.
echo Add this entry:
echo.
echo {
echo   "canvasflow": {
echo     "command": "node",
echo     "args": ["%INSTALL_DIR%\\host.js"]
echo   }
echo }
echo.
echo Then restart Claude Desktop and ask: 'What are my Canvas courses?'
echo.
echo Final steps:
echo 1. Restart Chrome
echo 2. Click 'Refresh Canvas Data' in the CanvasFlow extension
echo 3. Restart Claude Desktop (if using MCP)
echo.
pause
