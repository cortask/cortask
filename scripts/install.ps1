# Cortask Installation Script for Windows
# Usage: irm https://raw.githubusercontent.com/cortask/cortask/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "⚡ Cortask Installer" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

# Check Node.js
Write-Host "→ Checking Node.js..." -NoNewline
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Node.js is not installed. Please install Node.js 20 or higher:" -ForegroundColor Red
    Write-Host "  https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

$nodeVersion = node --version
Write-Host " ✓ ($nodeVersion)" -ForegroundColor Green

$majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($majorVersion -lt 20) {
    Write-Host ""
    Write-Host "⚠ Warning: Node.js 20 or higher is required." -ForegroundColor Yellow
    Write-Host "  Current version: $nodeVersion" -ForegroundColor Yellow
    Write-Host "  Please upgrade at: https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

# Check pnpm
Write-Host "→ Checking pnpm..." -NoNewline
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ pnpm installed" -ForegroundColor Green
} else {
    $pnpmVersion = pnpm --version
    Write-Host " ✓ ($pnpmVersion)" -ForegroundColor Green
}

# Setup pnpm global directory
Write-Host "→ Setting up pnpm..." -NoNewline
pnpm setup 2>&1 | Out-Null
Write-Host " ✓" -ForegroundColor Green

# Check git
Write-Host "→ Checking git..." -NoNewline
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Git is not installed. Please install Git:" -ForegroundColor Red
    Write-Host "  https://git-scm.com/download/win" -ForegroundColor Cyan
    exit 1
}
$gitVersion = git --version
Write-Host " ✓ ($gitVersion)" -ForegroundColor Green

# Set installation directory
$installDir = "$env:USERPROFILE\.cortask"

# Check if already installed
if (Test-Path $installDir) {
    Write-Host ""
    Write-Host "⚠ Cortask is already installed at:" -ForegroundColor Yellow
    Write-Host "  $installDir" -ForegroundColor Cyan
    Write-Host ""
    $response = Read-Host "Do you want to reinstall? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
    Write-Host ""
    Write-Host "→ Removing existing installation..." -NoNewline
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host " ✓" -ForegroundColor Green
}

# Clone repository
Write-Host "→ Cloning repository..." -NoNewline
git clone --quiet https://github.com/cortask/cortask.git $installDir 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed to clone repository" -ForegroundColor Red
    exit 1
}
Write-Host " ✓" -ForegroundColor Green

Set-Location $installDir

# Install dependencies
Write-Host "→ Installing dependencies..." -NoNewline
pnpm install --silent 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host " ✓" -ForegroundColor Green

# Build packages
Write-Host "→ Building packages..." -NoNewline
pnpm run build:deps --silent 2>&1 | Out-Null
pnpm -F @cortask/gateway build --silent 2>&1 | Out-Null
pnpm -F @cortask/ui build --silent 2>&1 | Out-Null
pnpm -F cortask build --silent 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed to build packages" -ForegroundColor Red
    exit 1
}
Write-Host " ✓" -ForegroundColor Green

# Link CLI globally
Write-Host "→ Linking CLI globally..." -NoNewline
pnpm link-cli 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed to link CLI" -ForegroundColor Red
    exit 1
}
Write-Host " ✓" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✓ Installation complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Installed at: $installDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Close and reopen your terminal" -ForegroundColor White
Write-Host "  2. Run: cortask credentials set provider.anthropic.apiKey YOUR_KEY" -ForegroundColor Cyan
Write-Host "  3. Start the server: cortask serve" -ForegroundColor Cyan
Write-Host ""
Write-Host "Get help: cortask --help" -ForegroundColor Gray
Write-Host ""
