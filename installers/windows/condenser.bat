@echo off
:: Wrapper that sets NODE_ENV and redirects output to the user log file.
set NODE_ENV=production
if not exist "%APPDATA%\condenser" mkdir "%APPDATA%\condenser"
"%~dp0condenser.exe" %* >> "%APPDATA%\condenser\condenser.log" 2>&1
