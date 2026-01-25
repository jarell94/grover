#!/usr/bin/env bash
# Verify Grover development environment is ready

echo "🔍 Checking Grover Development Environment..."
echo ""

ERRORS=0

# Check .env file
echo "📄 Environment File:"
if [[ -f "/Users/jarell/grover/.env" ]]; then
  if grep -q "MONGO_URL" /Users/jarell/grover/.env; then
    echo "  ✅ .env exists with MONGO_URL"
  else
    echo "  ❌ .env exists but missing MONGO_URL"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ .env file not found"
  ERRORS=$((ERRORS + 1))
fi

# Check Python
echo ""
echo "🐍 Python:"
if command -v python3 >/dev/null 2>&1; then
  VER=$(python3 --version)
  echo "  ✅ $VER"
else
  echo "  ❌ Python 3 not found"
  ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo ""
echo "🟢 Node.js:"
if command -v node >/dev/null 2>&1; then
  VER=$(node --version)
  echo "  ✅ $VER"
else
  echo "  ❌ Node.js not found"
  ERRORS=$((ERRORS + 1))
fi

# Check npm
echo ""
echo "📦 npm:"
if command -v npm >/dev/null 2>&1; then
  VER=$(npm --version)
  echo "  ✅ $VER"
else
  echo "  ❌ npm not found"
  ERRORS=$((ERRORS + 1))
fi

# Check MongoDB
echo ""
echo "🗄️  MongoDB:"
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "  ✅ MongoDB running"
  else
    echo "  ⚠️  MongoDB installed but not running"
    echo "     Start with: brew services start mongodb-community"
  fi
elif command -v mongo >/dev/null 2>&1; then
  echo "  ⚠️  MongoDB CLI found but not fully configured"
else
  echo "  ❌ MongoDB not installed"
  echo "     Install with: brew install mongodb-community"
  ERRORS=$((ERRORS + 1))
fi

# Check backend dependencies
echo ""
echo "📚 Backend Dependencies:"
if [[ -d "/Users/jarell/grover/backend/venv" ]]; then
  echo "  ✅ Virtual environment exists"
  if [[ -f "/Users/jarell/grover/backend/venv/bin/python" ]]; then
    echo "  ✅ Python available in venv"
  else
    echo "  ❌ Python not found in venv"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ Virtual environment not found"
  ERRORS=$((ERRORS + 1))
fi

# Check frontend dependencies
echo ""
echo "🎨 Frontend Dependencies:"
if [[ -d "/Users/jarell/grover/frontend/node_modules" ]]; then
  echo "  ✅ npm packages installed"
else
  echo "  ❌ npm packages not installed"
  echo "     Run: cd frontend && npm install"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "═══════════════════════════════════════"
if [[ $ERRORS -eq 0 ]]; then
  echo "✅ Everything looks good! Ready to start development"
  echo ""
  echo "Run these in separate terminals:"
  echo "  1. cd backend && source venv/bin/activate && python3 server.py"
  echo "  2. cd frontend && npm start"
else
  echo "❌ Found $ERRORS issue(s). See above for details."
  exit 1
fi
