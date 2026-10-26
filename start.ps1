# LinkedIn Post Scheduler - PowerShell Startup Script
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          LINKEDIN POST SCHEDULER & AI CAMPAIGN ENGINE" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on your system PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) from https://nodejs.org/"
    pause
    exit 1
}

$nodeVersion = node -v
Write-Host "[1/3] Node.js environment detected: $nodeVersion" -ForegroundColor Gray

# 2. Verify Dependencies
Write-Host "[2/3] Checking dependencies..." -ForegroundColor Gray
if (-not (Test-Path "node_modules")) {
    Write-Host "      Installing root dependencies..." -ForegroundColor Yellow
    npm install
}
if (-not (Test-Path "server\node_modules")) {
    Write-Host "      Installing server dependencies..." -ForegroundColor Yellow
    Set-Location server; npm install; Set-Location ..
}
if (-not (Test-Path "client\node_modules")) {
    Write-Host "      Installing client dependencies..." -ForegroundColor Yellow
    Set-Location client; npm install; Set-Location ..
}
Write-Host "      All dependencies verified." -ForegroundColor Green

# 3. Launch App and Browser
Write-Host ""
Write-Host "[3/3] Starting LinkedIn Scheduler (Backend: :3001, Frontend: :5173)..." -ForegroundColor Cyan
Write-Host "      Opening web application at http://localhost:5173 ..." -ForegroundColor Green

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5173"
} | Out-Null

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Application is running! Press Ctrl+C to terminate both servers." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
