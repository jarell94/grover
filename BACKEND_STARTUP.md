# 🚀 Grover Backend Startup Guide

## Issue Fixed
The backend was failing with:
```
KeyError: 'MONGO_URL'
```

This happened because the environment variables weren't properly configured.

---

## ✅ What Was Done

### 1. **Fixed Environment Variables**
Updated `.env.development` with correct variable names that match `server.py`:
- ✅ `MONGO_URL` (not `MONGODB_URL`)
- ✅ `DB_NAME` (not `DATABASE_NAME`)
- ✅ `PAYPAL_CLIENT_SECRET` (not `PAYPAL_SECRET`)

### 2. **Updated Setup Scripts**
- Enhanced `dev-setup.sh` with better error handling
- Added MongoDB availability checking
- Automatic `.env` file creation from `.env.development`

### 3. **Created Helper Scripts**
- `quick-start.sh` - Quick setup guide
- `verify-setup.sh` - Check if everything is configured
- `ENV_SETUP.md` - Detailed environment setup docs

---

## 🎯 Quick Start (3 Steps)

### Step 1: Setup Environment
```bash
cd /Users/jarell/grover
cp .env.development .env
```

### Step 2: Start MongoDB
```bash
# If not running already
brew services start mongodb-community
```

### Step 3: Start Backend
```bash
cd backend
source venv/bin/activate
python3 server.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 📋 Full .env Configuration

Create `/Users/jarell/grover/.env` with:

```bash
# REQUIRED for backend to start
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_dev

# Optional but recommended
ALLOWED_ORIGINS=*,http://localhost:3000,http://localhost:8081

# Optional: Live Streaming
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=

# Optional: Payments (sandbox)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Optional: Media Storage (uses base64 if not configured)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_NAME=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 🔧 Verify Setup

Check everything is configured:
```bash
bash /Users/jarell/grover/verify-setup.sh
```

---

## 🐛 Troubleshooting

### Issue: `KeyError: 'MONGO_URL'`
**Solution:** Create `.env` file in root directory with `MONGO_URL=mongodb://localhost:27017`

### Issue: Connection refused to MongoDB
**Solution:** Start MongoDB with:
```bash
brew services start mongodb-community
```

### Issue: Module not found errors
**Solution:** Reinstall backend dependencies:
```bash
cd backend
source venv/bin/activate
python3 -m pip install -r requirements.txt
```

### Issue: Port 8000 already in use
**Solution:** Change in `.env`:
```bash
BACKEND_PORT=8001
```

---

## 📁 Project Structure for Reference

```
grover/
├── .env                 ← CREATE THIS (copy from .env.development)
├── .env.development     ← Template with correct variable names
├── backend/
│   ├── server.py        ← Main FastAPI server
│   ├── venv/            ← Python virtual environment
│   └── requirements.txt
├── frontend/
│   ├── app/             ← Expo app screens
│   ├── package.json
│   └── node_modules/
├── dev-setup.sh         ← Full setup script
├── quick-start.sh       ← Quick environment setup
└── verify-setup.sh      ← Check configuration
```

---

## 🎬 Next Steps

1. ✅ Create `.env` file with `MONGO_URL`
2. ✅ Start MongoDB
3. ✅ Run backend: `python3 server.py`
4. ✅ Run frontend: `npm start` (in separate terminal)

---

## 📚 Related Files
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Full development guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Detailed environment setup
- [DEV_STATUS.md](./DEV_STATUS.md) - Development status

---

**All set!** 🎉 The backend should now start successfully.
