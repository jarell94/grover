#!/usr/bin/env bash
# Pre-launch checklist for Grover backend

echo "🔍 Grover Backend Pre-Launch Checklist"
echo "======================================"
echo ""

READY=true

# Check .env files exist
echo "1. Environment Files:"
if [[ -f "/Users/jarell/grover/.env" ]]; then
  echo "   ✅ /grover/.env exists"
else
  echo "   ❌ /grover/.env missing"
  READY=false
fi

if [[ -f "/Users/jarell/grover/backend/.env" ]]; then
  echo "   ✅ /grover/backend/.env exists"
else
  echo "   ❌ /grover/backend/.env missing"
  READY=false
fi

# Check MONGO_URL is set
echo ""
echo "2. Environment Variables:"
cd /Users/jarell/grover/backend
source venv/bin/activate 2>/dev/null
MONGO_URL=$(python3 -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print(os.environ.get('MONGO_URL', ''))" 2>/dev/null)
if [[ ! -z "$MONGO_URL" ]]; then
  echo "   ✅ MONGO_URL is set: $MONGO_URL"
else
  echo "   ❌ MONGO_URL not found"
  READY=false
fi

DB_NAME=$(python3 -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print(os.environ.get('DB_NAME', ''))" 2>/dev/null)
if [[ ! -z "$DB_NAME" ]]; then
  echo "   ✅ DB_NAME is set: $DB_NAME"
else
  echo "   ❌ DB_NAME not found"
  READY=false
fi

# Check Python virtual environment
echo ""
echo "3. Python Environment:"
if [[ -d "/Users/jarell/grover/backend/venv" ]]; then
  echo "   ✅ Virtual environment exists"
else
  echo "   ❌ Virtual environment missing"
  READY=false
fi

# Check required packages
echo ""
echo "4. Required Packages:"
MISSING=0
for pkg in fastapi motor pydantic; do
  if python3 -c "import $pkg" 2>/dev/null; then
    echo "   ✅ $pkg installed"
  else
    echo "   ❌ $pkg missing"
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -gt 0 ]]; then
  READY=false
fi

# Check MongoDB
echo ""
echo "5. MongoDB:"
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "   ✅ MongoDB is running"
  else
    echo "   ⚠️  MongoDB not running - START IT WITH: brew services start mongodb-community"
  fi
elif command -v mongo >/dev/null 2>&1; then
  echo "   ⚠️  MongoDB CLI installed but checking status..."
  echo "   START IT WITH: brew services start mongodb-community"
else
  echo "   ❌ MongoDB not installed"
  echo "   INSTALL WITH: brew install mongodb-community"
  READY=false
fi

# Summary
echo ""
echo "======================================"
if $READY; then
  echo "✅ All checks passed!"
  echo ""
  echo "Ready to start backend:"
  echo "  cd /Users/jarell/grover/backend"
  echo "  source venv/bin/activate"
  echo "  python3 server.py"
else
  echo "❌ Some checks failed. See above."
fi
