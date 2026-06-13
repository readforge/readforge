@echo off
title ReadForge - Build Windows App
echo.
echo Building ReadForge for Windows...
echo The finished app will appear in the release folder.
echo.
npm run dist
echo.
echo Done. Check the release folder.
pause
