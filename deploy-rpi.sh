#!/bin/bash
# ============================================================
# AI Coach - Raspberry Pi Deployment Script (ARM)
# Builds Docker containers from scratch for ARM architecture
# Ports: 9060 (frontend), 9061 (backend)
# ============================================================
set -e

# Save original stdout to fd 3
exec 3>&1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Redirect all output and errors to deploy.log in the script directory
LOG_FILE="deploy.log"
exec > "$LOG_FILE" 2>&1

echo "=== AI Coach - Raspberry Pi ARM Deployment ==="
echo "=== AI Coach - Raspberry Pi ARM Deployment ===" >&3
echo ""

# --- Prerequisites Check ---
echo "[1/5] Checking prerequisites..."
echo "[1/5] Checking prerequisites..." >&3

if ! docker --version > /dev/null 2>&1; then
    echo "ERROR: Docker is not installed or not in PATH."
    echo "Install with: curl -fsSL https://get.docker.com | sh"
    echo "Then: sudo usermod -aG docker \$USER && newgrp docker"
    exit 1
fi

if ! docker compose version > /dev/null 2>&1; then
    echo "ERROR: Docker Compose is not installed."
    echo "Install with: sudo apt install docker-compose-plugin"
    exit 1
fi

# Check if Ollama is installed
if ! command -v ollama > /dev/null 2>&1; then
    echo "WARNING: Ollama is not installed. The AI Coach chat will not work."
    echo "Install with: curl -fsSL https://ollama.com/install.sh | sh"
    echo "Continuing without Ollama..."
else
    echo "  Ollama found."
    # Ensure Ollama is running
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "  Starting Ollama..."
        ollama serve &
        sleep 3
    fi
    # Pull model if not present (qwen3:1.7b for RPi)
    if ! ollama list | grep -q "qwen3:1.7b"; then
        echo "  Pulling qwen3:1.7b model (optimized for ARM)..."
        ollama pull qwen3:1.7b
    else
        echo "  qwen3:1.7b model already available."
    fi
fi

# Set model env var for docker-compose
export OLLAMA_MODEL=qwen3:1.7b

# --- Stop existing containers ---
echo ""
echo "[2/5] Stopping existing containers (if any)..."
echo "[2/5] Stopping existing containers (if any)..." >&3
docker compose down > /dev/null 2>&1 || true

# --- Build from scratch (ARM native) ---
echo ""
echo "[3/5] Building Docker images from scratch for ARM..."
echo "[3/5] Building Docker images from scratch for ARM..." >&3
echo "  This may take several minutes on Raspberry Pi. Check deploy.log for details."
echo "  This may take several minutes on Raspberry Pi. Check deploy.log for details." >&3
docker compose build --no-cache

# --- Start services ---
echo ""
echo "[4/5] Starting services..."
echo "[4/5] Starting services..." >&3
docker compose up -d

echo ""
echo "  Frontend: http://localhost:9060"
echo "  Backend:  http://localhost:9061"

# --- Local Network Access (Recommended) ---
echo ""
echo "[5/5] Determining Local Network Access..."
echo "[5/5] Determining Local Network Access..." >&3

LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=== Deployment complete ==="
echo "=== Deployment complete ===" >&3
echo "" >&3
echo "Your AI Coach is running natively on your local network!" >&3
echo "You can access it from your phone/tablet by visiting:" >&3
echo "  👉 http://$LOCAL_IP:9060" >&3
echo "" >&3
echo "(Make sure your device is connected to the same Wi-Fi)" >&3
