@echo off
title ReadForge - One-Time GitHub Update Setup
echo.
echo This one-time setup uploads ReadForge to your GitHub repo and creates release tag v1.7.0.
echo Repo: readforge/readforge
echo.
echo You may be asked to sign into GitHub in a browser.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\setup-github-updates.ps1" -RepoOwner "readforge" -RepoName "readforge" -VersionTag "v1.7.0"
echo.
pause
