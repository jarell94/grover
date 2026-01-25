#!/usr/bin/env bash
# Quick setup for MongoDB and environment variables

set -e

cd /Users/jarell/grover

# Copy environment file
echo "Setting up environment..."
if [[ ! -f ".env" ]]; then
  cp .env.development .env
  echo "✅ Created .env from .env.development"
fi

# Check if MongoDB is running
echo ""
echo "Checking MongoDB..."
if command -v mongosh >/dev/null 2>&1; then
  mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1 && \
    echo "✅ MongoDB is running" || \
    echo "⚠️  MongoDB not running. Start with: brew services start mongodb-community"
else
  echo "⚠️  MongoDB not found. Install with: brew install mongodb-community"
fi

echo ""
echo "✅ Ready to start development"
echo ""
echo "Run these in separate terminals:"
echo "  1. cd backend && source venv/bin/activate && python3 server.py"
echo "  2. cd frontend && npm start"
