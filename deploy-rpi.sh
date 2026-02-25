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
echo ""

# --- Prerequisites Check ---
echo "[1/5] Checking prerequisites..."

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
docker compose down > /dev/null 2>&1 || true

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

if ! command -v ngrok > /dev/null 2>&1; then
    echo "WARNING: ngrok is not installed."
    echo "Install with:"
    echo "  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-arm64.tgz | sudo tar xzf - -C /usr/local/bin"
    echo "  ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    echo "After installing, run: ngrok http 9060"
    echo ""
    echo "=== Deployment complete (without ngrok) ==="
    echo "Deployment complete (without ngrok)" >&3
else
    # Kill any existing ngrok process
    pkill ngrok || true
    
    echo "Starting ngrok tunnel on port 9060 in background..."
    ngrok http 9060 > /dev/null 2>&1 &
    
    # Wait for ngrok to initialize
    sleep 5
    
    # Fetch the public URL from ngrok's local API
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | cut -d'"' -f4 | head -n 1)
    
    if [ -n "$NGROK_URL" ]; then
        echo "Ngrok tunnel established successfully."
        echo "$NGROK_URL" >&3
    else
        echo "Failed to get ngrok URL. You may need to check the deploy.log for details."
        echo "Failed to get ngrok URL." >&3
    fi
fi
