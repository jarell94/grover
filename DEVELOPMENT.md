# Grover Development Build Guide

## Quick Start

### Prerequisites
- Node.js & npm (for frontend)
- Python 3.11+ (for backend)
- MongoDB (for database)

### Setup Steps

1. **Run the setup script:**
   ```bash
   bash dev-setup.sh
   ```

2. **Start the backend (Terminal 1):**
   ```bash
   cd backend
   source venv/bin/activate
   python3 server.py
   ```
   Backend will run on `http://localhost:8000`

3. **Start the frontend (Terminal 2):**
   ```bash
   cd frontend
   npm start
   ```
   Follow the prompts to run in iOS simulator, Android emulator, or web

## Project Structure

```
grover/
├── backend/           # Python FastAPI backend
│   ├── server.py      # Main server entry point
│   ├── requirements.txt
│   └── venv/          # Python virtual environment
├── frontend/          # React Native/Expo frontend
│   ├── app/           # App screens and navigation
│   ├── components/    # Reusable components
│   ├── services/      # API and socket services
│   └── package.json
└── .env.development   # Development environment variables
```

## Backend Development

### API Server
- **Framework:** FastAPI
- **Entry point:** `backend/server.py`
- **Port:** 8000
- **Database:** MongoDB (motor for async)

### Available Backend Services
- Media service (video, image handling)
- PayPal integration
- Agora live streaming
- Performance monitoring
- Query optimization

### Running Backend Tests
```bash
cd backend
source venv/bin/activate
pytest
```

### Backend File Structure
```
backend/
├── server.py              # Main FastAPI app
├── media_service.py       # Media handling
├── paypal_service.py      # PayPal integration
├── paypal_payout_service.py
├── db_optimize.py         # Database optimization
├── performance_monitor.py
├── performance_benchmark.py
├── query_analyzer.py
└── requirements.txt
```

## Frontend Development

### App Framework
- **Framework:** Expo + React Native
- **Routing:** Expo Router (file-based)
- **TypeScript:** Enabled
- **Port:** 8081 (default)

### Running Frontend
```bash
cd frontend
npm start
```

Then choose:
- `i` for iOS simulator
- `a` for Android emulator
- `w` for web browser

### Frontend Screens
- Authentication
- Marketplace
- Collections
- Communities
- Live Streaming
- Chat/Messaging
- Profiles
- Studio (content creation)

### Linting
```bash
cd frontend
npm run lint
```

## Environment Configuration

Copy `.env.development` and add your API keys:

```bash
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SOCKET_URL=http://localhost:8000

# External Services (get from provider dashboards)
AGORA_APP_ID=your_id
PAYPAL_CLIENT_ID=your_id
AWS_ACCESS_KEY_ID=your_key
CLOUDINARY_API_KEY=your_key
```

## VS Code Tasks

Quick access to common tasks:
- **Ctrl+Shift+B:** Run Dev Setup
- **Terminal** → **Run Task:** See all available tasks

Available tasks:
- Backend: Start Server
- Frontend: Start Expo
- Frontend: Lint
- Backend: Run Tests
- Dev Setup: Install Dependencies

## Common Development Workflows

### Debugging Backend
```bash
cd backend
source venv/bin/activate
python3 -m pdb server.py
```

### Debugging Frontend
Use React Native debugger or browser dev tools (for web)

### Database Management
```bash
# Check MongoDB is running
mongosh

# Connect to dev database
mongosh mongodb://localhost:27017/grover_dev
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
# Then commit
git add .
git commit -m "feat: description"
```

## Testing

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest -v
pytest tests/ -v        # Run specific test directory
pytest tests/test_*.py   # Run specific test files
```

### Frontend Testing
```bash
cd frontend
npm run lint  # Linting checks
```

## Troubleshooting

### Backend won't start
1. Check MongoDB is running: `mongosh`
2. Verify virtual environment: `source venv/bin/activate`
3. Install missing dependencies: `python3 -m pip install -r requirements.txt`

### Frontend issues
1. Clear cache: `npm cache clean --force`
2. Reinstall: `rm -rf node_modules && npm install`
3. Reset Expo: `expo start -c`

### Port conflicts
- Backend: Change `BACKEND_PORT` in `.env.development`
- Frontend: `npm start -- --port 8082`

## Performance Tips

- Use `performance_monitor.py` to track API performance
- Run `performance_benchmark.py` for load testing
- Check `query_analyzer.py` for slow database queries

## Documentation

- [Expo Docs](https://docs.expo.dev)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [React Native Docs](https://reactnative.dev)
- [MongoDB Docs](https://docs.mongodb.com)

---

**Ready to develop!** 🚀
