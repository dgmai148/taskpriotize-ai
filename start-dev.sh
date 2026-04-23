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
  # stop the postgres container
  docker stop taskprio-postgres 2>/dev/null || true
  docker rm taskprio-postgres 2>/dev/null || true
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# --- pre-flight checks ---
echo -e "${YELLOW}Checking prerequisites...${NC}"

for cmd in docker node npm python3; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Error: '$cmd' is not installed.${NC}"
    exit 1
  fi
done

# --- kill processes occupying required ports ---
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}  Port $port is in use (pid $pids). Killing...${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

echo -e "${YELLOW}Checking for port conflicts...${NC}"
kill_port 5050
kill_port 4000
kill_port 3000

# --- 1. PostgreSQL (Docker) ---
echo -e "${GREEN}Starting PostgreSQL...${NC}"
if docker ps --format '{{.Names}}' | grep -q '^taskprio-postgres$'; then
  echo "  PostgreSQL container already running."
else
  docker rm -f taskprio-postgres 2>/dev/null || true
  docker run -d \
    --name taskprio-postgres \
    -e POSTGRES_USER=taskprio \
    -e POSTGRES_PASSWORD=taskprio_secret \
    -e POSTGRES_DB=taskprio \
    -p 5433:5432 \
    -v "$ROOT_DIR/db/init.sql:/docker-entrypoint-initdb.d/01-init.sql" \
    postgres:16-alpine >/dev/null
  echo "  Waiting for PostgreSQL to be ready..."
  until docker exec taskprio-postgres pg_isready -U taskprio &>/dev/null; do
    sleep 1
  done
  echo "  PostgreSQL ready on port 5433."
fi

# --- 2. ML Service (Flask) ---
echo -e "${GREEN}Starting ML Service...${NC}"
if [ ! -d "$ROOT_DIR/ml-service/venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv "$ROOT_DIR/ml-service/venv"
fi
source "$ROOT_DIR/ml-service/venv/bin/activate"
pip install -q -r "$ROOT_DIR/ml-service/requirements.txt"

cd "$ROOT_DIR/ml-service"
FLASK_PORT=5050 python3 app.py &
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

export DATABASE_URL="postgresql://taskprio:taskprio_secret@localhost:5433/taskprio"
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
echo "  PostgreSQL  : localhost:5433"
echo "  ML Service  : http://localhost:5050"
echo "  Backend API : http://localhost:4000"
echo "  Frontend    : http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"

# keep script alive
wait
