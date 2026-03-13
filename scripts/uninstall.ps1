# Cortask Uninstall Script for Windows
# Usage: irm https://raw.githubusercontent.com/cortask/cortask/main/scripts/uninstall.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "⚡ Cortask Uninstaller" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

$installDir = "$env:USERPROFILE\.cortask"

if (!(Test-Path $installDir)) {
    Write-Host "Cortask is not installed." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host "Installation found at:" -ForegroundColor Yellow
Write-Host "  $installDir" -ForegroundColor Cyan
Write-Host ""
$response = Read-Host "Are you sure you want to uninstall? (y/N)"

if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "Uninstall cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Unlink CLI
Write-Host "→ Unlinking CLI..." -NoNewline
Set-Location $installDir
pnpm -F cortask unlink --global 2>&1 | Out-Null
Write-Host " ✓" -ForegroundColor Green

# Remove installation directory
Write-Host "→ Removing files..." -NoNewline
Set-Location $env:USERPROFILE
Remove-Item -Path $installDir -Recurse -Force
Write-Host " ✓" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✓ Uninstall complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Cortask has been removed from your system." -ForegroundColor Gray
Write-Host ""
