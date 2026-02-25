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

# --- Cloudflare Tunnel (cloudflared) ---
echo ""
echo "[5/5] Setting up Cloudflare tunnel (cloudflared)..."
echo "[5/5] Setting up Cloudflare tunnel..." >&3

if ! command -v cloudflared > /dev/null 2>&1; then
    echo "Installing cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

# Kill any existing cloudflared process
pkill cloudflared || true

echo "Starting Cloudflare Quick Tunnel on port 9060 in background..."
echo "Starting Cloudflare Quick Tunnel on port 9060 in background..." >&3

# cloudflared Quick Tunnels log everything to standard error
nohup cloudflared tunnel --url http://localhost:9060 > cloudflared.log 2>&1 &

echo "Waiting for Cloudflare tunnel to initialize..."
echo "Waiting for Cloudflare tunnel to initialize..." >&3

# Retry loop to fetch the public URL from the logs
CLOUDFLARE_URL=""
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 2
    # The quick tunnel URL always ends in trycloudflare.com
    CLOUDFLARE_URL=$(grep -o 'https://[-a-zA-Z0-9]*\.trycloudflare\.com' cloudflared.log | head -n 1)
    if [ -n "$CLOUDFLARE_URL" ]; then
        break
    fi
    echo "Still waiting ($i/15)..." >&3
done

if [ -n "$CLOUDFLARE_URL" ]; then
    echo "Cloudflare tunnel established successfully."
    echo "Cloudflare tunnel established successfully." >&3
    echo "Backend URL: $CLOUDFLARE_URL"
    echo "Your AI Coach is publicly accessible at:" >&3
    echo "$CLOUDFLARE_URL" >&3
    
    # Save the URL for reference
    echo "$CLOUDFLARE_URL" > current_tunnel_url.txt
else
    echo "Failed to get Cloudflare URL. You may need to check cloudflared.log for details."
    echo "Failed to get Cloudflare URL. Check cloudflared.log on the device." >&3
    cat cloudflared.log | tail -n 10 >&3
fi
