#!/usr/bin/env bash
# Quick reference for network configuration

cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║         GROVER NETWORK CONFIGURATION SUMMARY             ║
╚══════════════════════════════════════════════════════════╝

🔧 CONFIGURATION
  Backend Port:     8001
  Backend URL:      http://192.168.1.101:8001
  Network IP:       192.168.1.101
  
📱 FRONTEND
  API Endpoint:     http://192.168.1.101:8001
  Socket Endpoint:  http://192.168.1.101:8001

🗄️  DATABASE
  MongoDB:          mongodb://localhost:27017
  Database Name:    grover_dev

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 START BACKEND
  $ cd backend
  $ source venv/bin/activate
  $ python3 server.py
  
  Expected output:
  INFO:     Uvicorn running on http://0.0.0.0:8001

🎨 START FRONTEND
  $ cd frontend
  $ npm start
  
  Then choose:
    i = iOS Simulator
    a = Android Emulator
    w = Web Browser
    j = Expo Go (on mobile device)

📋 VERIFY SETUP
  Backend health:    curl http://192.168.1.101:8001/health
  Backend docs:      http://192.168.1.101:8001/docs
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 UPDATED FILES
  ✅ .env
  ✅ backend/.env
  ✅ .env.development
  ✅ test_reactions.py
  ✅ test_collections.py
  ✅ backend/performance_monitor.py
  ✅ backend/performance_benchmark.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 MORE INFO: See NETWORK_CONFIG.md

EOF
