#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- colours ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# --- pid tracking for cleanup ---
PIDS=()

cleanup() {
  echo -e "\n${YELLOW}Shutting down services...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
  done
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# --- pre-flight checks ---
echo -e "${YELLOW}Checking prerequisites...${NC}"

for cmd in node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Error: '$cmd' is not installed.${NC}"
    exit 1
  fi
done

# python3 on Linux/macOS, python on Windows
PYTHON="python3"
if ! command -v python3 &>/dev/null; then
  if command -v python &>/dev/null; then
    PYTHON="python"
  else
    echo -e "${RED}Error: 'python' is not installed.${NC}"
    exit 1
  fi
fi

# --- kill processes occupying required ports ---
kill_port() {
  local port=$1
  local pids
  # Works on both Linux (lsof) and Windows Git Bash (netstat)
  if command -v lsof &>/dev/null; then
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
  else
    pids=$(netstat -ano 2>/dev/null | grep ":$port " | grep "LISTENING" | awk '{print $5}' | sort -u || true)
  fi
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}  Port $port is in use (pid $pids). Killing...${NC}"
    for p in $pids; do
      kill -9 "$p" 2>/dev/null || taskkill //PID "$p" //F 2>/dev/null || true
    done
    sleep 1
  fi
}

echo -e "${YELLOW}Checking for port conflicts...${NC}"
kill_port 5050
kill_port 4000
kill_port 3000

# --- 1. SQLite Database ---
echo -e "${GREEN}Setting up SQLite database...${NC}"
DB_DIR="$ROOT_DIR/backend/data"
DB_PATH="$DB_DIR/taskprio.db"
if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
  echo "  Created data directory."
fi
export SQLITE_PATH="$DB_PATH"
echo "  SQLite database: $DB_PATH"

# --- 2. ML Service (Flask) ---
echo -e "${GREEN}Starting ML Service...${NC}"
if [ ! -d "$ROOT_DIR/ml-service/venv" ]; then
  echo "  Creating Python virtual environment..."
  $PYTHON -m venv "$ROOT_DIR/ml-service/venv"
fi
# Activate venv (Scripts on Windows, bin on Linux/macOS)
if [ -f "$ROOT_DIR/ml-service/venv/Scripts/activate" ]; then
  source "$ROOT_DIR/ml-service/venv/Scripts/activate"
else
  source "$ROOT_DIR/ml-service/venv/bin/activate"
fi
pip install -q -r "$ROOT_DIR/ml-service/requirements.txt"

cd "$ROOT_DIR/ml-service"
FLASK_PORT=5050 $PYTHON app.py &
PIDS+=($!)
cd "$ROOT_DIR"
deactivate

echo "  ML Service starting on port 5050..."
until curl -sf http://localhost:5050/health &>/dev/null; do
  sleep 1
done
echo "  ML Service ready."

# --- 3. Backend (Express / nodemon) ---
echo -e "${GREEN}Starting Backend...${NC}"
if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
  echo "  Installing backend dependencies..."
  npm install --prefix "$ROOT_DIR/backend" --silent
fi

export ML_SERVICE_URL="http://localhost:5050"
export NODE_ENV=development
export JWT_ISSUER=taskprio-app
export CORS_ORIGIN="http://localhost:3000"

PORT=4000 npm run dev --prefix "$ROOT_DIR/backend" &
PIDS+=($!)
echo "  Backend starting on port 4000..."

# --- 4. Frontend (React dev server) ---
echo -e "${GREEN}Starting Frontend...${NC}"
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "  Installing frontend dependencies..."
  npm install --prefix "$ROOT_DIR/frontend" --silent
fi

export REACT_APP_API_URL="http://localhost:4000"

npm start --prefix "$ROOT_DIR/frontend" &
PIDS+=($!)
echo "  Frontend starting on port 3000..."

# --- summary ---
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All services starting!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  SQLite DB   : $DB_PATH"
echo "  ML Service  : http://localhost:5050"
echo "  Backend API : http://localhost:4000"
echo "  Frontend    : http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"

# keep script alive
wait
