#!/usr/bin/env bash
# Grover Development Build Setup
set -Eeuo pipefail

echo "🚀 Starting Grover Development Build..."

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper: pretty errors
trap 'echo -e "\n❌ Script failed on line $LINENO\n" >&2' ERR

# Check if we're in the right directory
if [[ ! -f "README.md" ]]; then
  echo "❌ Please run this script from the grover root directory"
  exit 1
fi

echo -e "${BLUE}📦 Environment Setup${NC}"

#####################################
# Backend
#####################################
echo -e "${YELLOW}Setting up backend...${NC}"
if [[ ! -d "backend" ]]; then
  echo "❌ backend/ folder not found"
  exit 1
fi

pushd backend >/dev/null

# Pick python
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "❌ Python not found. Install Python 3 first."
  exit 1
fi

# Create venv if missing
if [[ ! -d "venv" ]]; then
  echo "Creating virtual environment..."
  "$PY" -m venv venv
fi

# Activate venv
# shellcheck disable=SC1091
source venv/bin/activate

# Ensure pip is usable
"$PY" -m pip install --upgrade pip >/dev/null

# Install deps
if [[ -f "requirements.txt" ]]; then
  echo "Installing backend dependencies..."
  "$PY" -m pip install -r requirements.txt
else
  echo "⚠️  No requirements.txt found in backend/"
fi

popd >/dev/null

#####################################
# Frontend
#####################################
echo -e "${YELLOW}Setting up frontend...${NC}"
if [[ ! -d "frontend" ]]; then
  echo "❌ frontend/ folder not found"
  exit 1
fi

pushd frontend >/dev/null

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm not found. Install Node.js (LTS) first."
  exit 1
fi

if [[ ! -d "node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm install
else
  echo "Frontend dependencies already installed"
fi

popd >/dev/null

#####################################
# Environment Setup
#####################################
echo -e "${YELLOW}Setting up environment variables...${NC}"
if [[ ! -f ".env" ]] && [[ -f ".env.development" ]]; then
  echo "Creating .env file from .env.development..."
  cp .env.development .env
  echo "✅ .env created (update with your API keys)"
elif [[ -f ".env" ]]; then
  echo "✅ .env file exists"
else
  echo "⚠️  No .env or .env.development found"
fi

# Check MongoDB
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
  else
    echo -e "${YELLOW}⚠️  MongoDB appears to be installed but not running${NC}"
    echo "   Start it with: mongod"
  fi
elif command -v mongo >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  MongoDB CLI found but not configured for this setup${NC}"
else
  echo -e "${YELLOW}⚠️  MongoDB not found. Install it or use: brew install mongodb-community${NC}"
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}🎯 To start development:${NC}"
echo ""
echo "1. Ensure MongoDB is running:"
echo "   mongod (or start MongoDB service)"
echo ""
echo "2. Backend (terminal 1):"
echo "   cd backend && source venv/bin/activate && python3 server.py"
echo ""
echo "3. Frontend (terminal 2):"
echo "   cd frontend && npm start"
echo ""
echo "Or use the provided VS Code tasks to start both"
echo ""
echo -e "${YELLOW}📝 Note: Update .env with your API keys before running${NC}"
