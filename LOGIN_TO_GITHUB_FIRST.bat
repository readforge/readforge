@echo off
title ReadForge - Login to GitHub First
echo.
echo This signs you into GitHub CLI before running the ReadForge setup.
echo.
gh auth login --hostname github.com --web --git-protocol https
echo.
echo If login succeeded, now run:
echo ONE_TIME_SETUP_READFORGE_UPDATES.bat
echo.
pause
