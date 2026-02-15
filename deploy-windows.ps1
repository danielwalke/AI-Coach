# ============================================================
# AI Coach - Windows Deployment Script
# Builds and starts Docker containers
# Ports: 9060 (frontend), 9061 (backend)
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "=== AI Coach - Windows Deployment ===" -ForegroundColor Cyan
Write-Host ""

# --- Prerequisites Check ---
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
try {
    docker version | Out-Null
    Write-Host "  Docker found." -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not running or not installed." -ForegroundColor Red
    Write-Host "Install Docker Desktop from: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

# Check Docker Compose
try {
    docker compose version | Out-Null
    Write-Host "  Docker Compose found." -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker Compose not available." -ForegroundColor Red
    exit 1
}

# Check Ollama
$ollamaRunning = $false
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -ErrorAction SilentlyContinue
    Write-Host "  Ollama is running." -ForegroundColor Green
    $ollamaRunning = $true
} catch {
    Write-Host "  WARNING: Ollama is not running. AI Coach chat will not work." -ForegroundColor Yellow
    Write-Host "  Install from: https://ollama.com/download" -ForegroundColor Yellow
    $continue = Read-Host "  Continue without Ollama? (y/n)"
    if ($continue -ne "y") { exit 1 }
}

# Pull model if Ollama is running
if ($ollamaRunning) {
    $models = ollama list 2>$null
    if ($models -notmatch "qwen3:8b") {
        Write-Host "  Pulling qwen3:8b model..." -ForegroundColor Yellow
        ollama pull qwen3:8b
    } else {
        Write-Host "  qwen3:8b model already available." -ForegroundColor Green
    }
}

# --- Stop existing ---
Write-Host ""
Write-Host "[2/5] Stopping existing containers..." -ForegroundColor Yellow
docker compose down 2>$null

# --- Build ---
Write-Host ""
Write-Host "[3/5] Building Docker images..." -ForegroundColor Yellow
docker compose build

# --- Start ---
Write-Host ""
Write-Host "[4/5] Starting services..." -ForegroundColor Yellow
docker compose up -d

Write-Host ""
Write-Host "  Frontend: http://localhost:9060" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:9061" -ForegroundColor Green

# --- Ngrok ---
Write-Host ""
Write-Host "[5/5] Setting up ngrok tunnel..." -ForegroundColor Yellow

$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Host "  WARNING: ngrok is not installed." -ForegroundColor Yellow
    Write-Host "  Install from: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "  After installing, run: ngrok http 9060" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=== Deployment complete (without ngrok) ===" -ForegroundColor Cyan
} else {
    Write-Host "  Starting ngrok tunnel on port 9060..." -ForegroundColor Green
    Write-Host "  Press Ctrl+C to stop ngrok (containers will keep running)" -ForegroundColor Gray
    Write-Host ""
    ngrok http 9060
}
