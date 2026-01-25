# 🔧 Environment Setup Instructions

## The Problem
The backend server was expecting `MONGO_URL` and `DB_NAME` environment variables, but they weren't configured.

## The Solution

### 1. Create the `.env` file
The `.env.development` file in the root has been updated with correct variable names. Copy it to `.env`:

```bash
cd /Users/jarell/grover
cp .env.development .env
```

Or the backend needs to load from the `.env` file:
```bash
cd /Users/jarell/grover/backend
cp ../.env.development .env
```

### 2. Required Environment Variables
The backend needs these **required** variables in `.env`:

```bash
# MongoDB - REQUIRED
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_dev

# Optional but good to have
ALLOWED_ORIGINS=*,http://localhost:3000,http://localhost:8081
```

### 3. Start MongoDB First
Before running the backend, MongoDB must be running:

```bash
# Check if installed
brew list mongodb-community

# Install if missing
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Or manually
mongod
```

### 4. Run the Backend
```bash
cd /Users/jarell/grover/backend
source venv/bin/activate
python3 server.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Fixed Issues

✅ **Variable names corrected:**
- `MONGODB_URL` → `MONGO_URL`
- `DATABASE_NAME` → `DB_NAME`
- `PAYPAL_SECRET` → `PAYPAL_CLIENT_SECRET`

✅ **Automatic .env setup:**
- `dev-setup.sh` now copies `.env.development` to `.env`
- MongoDB availability is checked
- Better startup instructions

## Optional API Keys
These are optional - the app has fallbacks:
- **Agora** - For live streaming (defaults to disabled)
- **PayPal** - For payments (sandbox mode)
- **Cloudinary/AWS** - For media (uses base64 fallback)

## Troubleshooting

### "MONGO_URL not found"
→ Create `.env` file in `/Users/jarell/grover/`

### "MongoDB connection refused"
→ Start MongoDB: `brew services start mongodb-community`

### "No module named 'motor'"
→ Reinstall dependencies: `python3 -m pip install -r requirements.txt`

---

**Next:** After setting up `.env` and starting MongoDB, run the backend!
