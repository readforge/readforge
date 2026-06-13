param(
  [string]$RepoOwner = "readforge",
  [string]$RepoName = "readforge",
  [string]$VersionTag = "v1.7.0"
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "=== $message ===" -ForegroundColor Cyan
}

function Command-Exists($command) {
  $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
}

Write-Step "ReadForge one-time GitHub update setup"
Write-Host "Repo: $RepoOwner/$RepoName"
Write-Host "Version tag: $VersionTag"
Write-Host ""

Write-Step "Checking Git"
if (-not (Command-Exists "git")) {
  Write-Host "Git was not found."
  if (Command-Exists "winget") {
    Write-Host "Installing Git with winget..."
    winget install --id Git.Git -e --source winget
  } else {
    throw "Git is not installed and winget was not found. Install Git from https://git-scm.com/download/win, then run this again."
  }
} else {
  git --version
}

Write-Step "Checking GitHub CLI"
if (-not (Command-Exists "gh")) {
  Write-Host "GitHub CLI was not found."
  if (Command-Exists "winget") {
    Write-Host "Installing GitHub CLI with winget..."
    winget install --id GitHub.cli -e --source winget
  } else {
    throw "GitHub CLI is not installed and winget was not found. Install GitHub CLI from https://cli.github.com/, then run this again."
  }
} else {
  gh --version
}

Write-Step "Refreshing PATH"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if (-not (Command-Exists "git")) {
  throw "Git still was not found after install. Close this window, reopen the setup BAT, and try again."
}
if (-not (Command-Exists "gh")) {
  throw "GitHub CLI still was not found after install. Close this window, reopen the setup BAT, and try again."
}

Write-Step "Signing into GitHub"
cmd /c "gh auth status >nul 2>nul"
$authExitCode = $LASTEXITCODE
if ($authExitCode -ne 0) {
  Write-Host "You are not logged into GitHub CLI yet."
  Write-Host "A browser/device login will open. Sign into the ReadForge GitHub account."
  gh auth login --hostname github.com --web --git-protocol https
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub login failed or was cancelled. Run this setup again after signing in."
  }
} else {
  Write-Host "GitHub CLI already appears to be signed in."
}

Write-Step "Checking repository access"
gh repo view "$RepoOwner/$RepoName" | Out-Host

Write-Step "Preparing local Git repository"
Push-Location $PSScriptRoot\..
try {
  if (-not (Test-Path ".git")) {
    git init
  }

  git branch -M main

  $originExists = $false
  $remotes = git remote
  foreach ($r in $remotes) {
    if ($r.Trim() -eq "origin") { $originExists = $true }
  }

  if (-not $originExists) {
    Write-Host "Adding GitHub remote origin..."
    git remote add origin "https://github.com/$RepoOwner/$RepoName.git"
  } else {
    Write-Host "Updating GitHub remote origin..."
    git remote set-url origin "https://github.com/$RepoOwner/$RepoName.git"
  }

  git config user.name "ReadForge Release Bot"
  git config user.email "readforge@users.noreply.github.com"

  Write-Step "Committing source"
  git add -A

  $hasChanges = git status --porcelain
  if ($hasChanges) {
    git commit -m "Prepare ReadForge $VersionTag auto-update release"
  } else {
    Write-Host "No source changes to commit."
  }

  Write-Step "Pushing source to GitHub"
  Write-Host "This will replace the partial/old GitHub contents with this complete ReadForge source."
  git push -u origin main --force
  if ($LASTEXITCODE -ne 0) {
    throw "Git push failed. Copy the red error text and send it to ChatGPT."
  }

  Write-Step "Creating/pushing release tag"
  $existingTag = git tag --list $VersionTag
  if ($existingTag) {
    Write-Host "Replacing existing local tag $VersionTag..."
    git tag -d $VersionTag
  }

  Write-Host "Creating local tag $VersionTag..."
  git tag $VersionTag

  Write-Host "Pushing tag $VersionTag..."
  git push origin $VersionTag --force
  if ($LASTEXITCODE -ne 0) {
    throw "Git tag push failed. Copy the red error text and send it to ChatGPT."
  }

  Write-Step "Done"
  Write-Host "GitHub source and tag were pushed."
  Write-Host "GitHub Actions should now build the release."
  Write-Host "Open: https://github.com/$RepoOwner/$RepoName/actions"
  Write-Host "Then check: https://github.com/$RepoOwner/$RepoName/releases"
  Write-Host ""
  Write-Host "After the release is built, install this version once. Future versions can update through ReadForge's Check for Updates."
}
finally {
  Pop-Location
}
