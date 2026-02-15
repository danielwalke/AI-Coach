#!/bin/bash
# ============================================================
# AI Coach - Raspberry Pi Deployment Script (ARM)
# Builds Docker containers from scratch for ARM architecture
# Ports: 9060 (frontend), 9061 (backend)
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AI Coach - Raspberry Pi ARM Deployment ==="
echo ""

# --- Prerequisites Check ---
echo "[1/5] Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    echo "Install with: curl -fsSL https://get.docker.com | sh"
    echo "Then: sudo usermod -aG docker \$USER && newgrp docker"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed."
    echo "Install with: sudo apt install docker-compose-plugin"
    exit 1
fi

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "WARNING: Ollama is not installed. The AI Coach chat will not work."
    echo "Install with: curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    read -p "Continue without Ollama? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
else
    echo "  Ollama found."
    # Ensure Ollama is running
    if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo "  Starting Ollama..."
        ollama serve &
        sleep 3
    fi
    # Pull model if not present
    if ! ollama list | grep -q "qwen3:8b"; then
        echo "  Pulling qwen3:8b model (this may take a while on ARM)..."
        ollama pull qwen3:8b
    else
        echo "  qwen3:8b model already available."
    fi
fi

# --- Stop existing containers ---
echo ""
echo "[2/5] Stopping existing containers (if any)..."
docker compose down 2>/dev/null || true

# --- Build from scratch (ARM native) ---
echo ""
echo "[3/5] Building Docker images from scratch for ARM..."
echo "  This may take several minutes on Raspberry Pi."
docker compose build --no-cache

# --- Start services ---
echo ""
echo "[4/5] Starting services..."
docker compose up -d

echo ""
echo "  Frontend: http://localhost:9060"
echo "  Backend:  http://localhost:9061"

# --- Ngrok tunnel ---
echo ""
echo "[5/5] Setting up ngrok tunnel..."

if ! command -v ngrok &> /dev/null; then
    echo "WARNING: ngrok is not installed."
    echo "Install with:"
    echo "  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-arm64.tgz | sudo tar xzf - -C /usr/local/bin"
    echo "  ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    echo "After installing, run: ngrok http 9060"
    echo ""
    echo "=== Deployment complete (without ngrok) ==="
else
    echo "Starting ngrok tunnel on port 9060..."
    echo "Press Ctrl+C to stop ngrok (containers will keep running)"
    echo ""
    ngrok http 9060
fi
