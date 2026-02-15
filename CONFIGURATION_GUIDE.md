# Configuration Placeholders Guide

**IMPORTANT:** Before deploying or submitting to app stores, the following placeholder values must be replaced with actual values.

## Frontend Configuration (`frontend/app.json`)

### Required Updates:

1. **Line 7: owner**
   ```json
   "owner": "your-expo-username"
   ```
   Replace with your Expo account username.

2. **Lines 103-106: Sentry**
   ```json
   "@sentry/react-native", {
     "organization": "your-sentry-org",
     "project": "grover"
   }
   ```
   Replace `your-sentry-org` with your Sentry organization slug.

3. **Lines 137-139: EAS Project ID**
   ```json
   "extra": {
     "eas": {
       "projectId": "your-project-id"
     }
   }
   ```
   Get project ID from: `eas init` or Expo dashboard.

4. **Line 151: Updates URL**
   ```json
   "url": "https://u.expo.dev/your-project-id"
   ```
   Update after running `eas update:configure`.

5. **Lines 114-120: Asset Paths (Optional)**
   ```json
   "icon": "./assets/images/notification-icon.png",
   "sounds": ["./assets/sounds/notification.wav"]
   ```
   Create these assets or remove if not using custom notification assets.

## Frontend Build Configuration (`frontend/eas.json`)

### Required Updates:

1. **Lines 46-49: Production API URLs**
   ```json
   "env": {
     "EXPO_PUBLIC_API_URL": "https://api.grover.app",
     "EXPO_PUBLIC_WS_URL": "https://api.grover.app"
   }
   ```
   Replace with your actual production API URLs.

2. **Lines 59-65: iOS Submission Config**
   ```json
   "appleId": "your-apple-id@example.com",
   "ascAppId": "your-asc-app-id",
   "appleTeamId": "your-team-id",
   "sku": "grover-app-001"
   ```
   
   **How to get these values:**
   - `appleId`: Your Apple ID email
   - `ascAppId`: From App Store Connect (numeric ID, e.g., 1234567890)
   - `appleTeamId`: From Apple Developer portal → Membership
   - `sku`: Unique product identifier (can keep as is or customize)

3. **Lines 66-70: Android Submission Config**
   ```json
   "serviceAccountKeyPath": "./google-play-service-account.json",
   "track": "production",
   "releaseStatus": "completed"
   ```
   
   **How to get service account:**
   - Go to Google Play Console → Setup → API access
   - Create service account
   - Download JSON key
   - Place at `frontend/google-play-service-account.json`
   - **IMPORTANT:** Add to `.gitignore` - never commit this file!

## Legal Documents

### PRIVACY_POLICY.md

**Lines 199-200, 230:**
```markdown
**Email:** privacy@grover.app  
**Mail:** Grover Privacy Team, [Your Address]
```

Replace `[Your Address]` with:
```
Grover Inc.
123 Main Street
San Francisco, CA 94102
United States
```

### TERMS_OF_SERVICE.md

**Line 230:**
```markdown
These Terms are governed by the laws of [Your Jurisdiction]
```

Replace with your actual jurisdiction, e.g.:
```
These Terms are governed by the laws of the State of California, United States
```

**Line 286:**
```markdown
**Mail:** Grover Legal Team, [Your Address]
```
Replace with actual mailing address (same as Privacy Policy).

## Backend Configuration (.env)

Create `backend/.env` file with actual values:

```env
# MongoDB
MONGO_URL=mongodb://your-actual-mongodb-url
DB_NAME=grover_production

# Security
SECRET_KEY=generate-a-secure-random-key-here

# Media Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# PayPal
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your-live-paypal-client-id
PAYPAL_CLIENT_SECRET=your-live-paypal-secret

# Agora
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate

# Sentry
SENTRY_DSN=your-sentry-dsn-url
ENVIRONMENT=production

# CORS
ALLOWED_ORIGINS=https://grover.app,https://www.grover.app

# Redis (optional but recommended)
REDIS_URL=redis://your-redis-url:6379
# If you don't want caching, you can omit REDIS_URL and remove redis from requirements.txt.
```

## Assets to Create

### Icons and Images

1. **App Icon** (`frontend/assets/images/icon.png`)
   - Size: 1024x1024 pixels
   - Format: PNG
   - No transparency (for iOS)
   - High quality, recognizable at small sizes

2. **Adaptive Icon** (`frontend/assets/images/adaptive-icon.png`)
   - Size: 1024x1024 pixels
   - Center 512x512 should contain key branding
   - Outer areas may be masked on Android

3. **Splash Screen** (`frontend/assets/images/splash-icon.png`)
   - Size: 1242x2436 pixels (or larger)
   - Centered logo on plain background

4. **Notification Icon** (`frontend/assets/images/notification-icon.png`)
   - Size: 96x96 pixels
   - Simple, monochrome design
   - Transparent background

5. **Favicon** (`frontend/assets/images/favicon.png`)
   - Size: 192x192 pixels or 512x512
   - For web version

### Sounds (Optional)

1. **Notification Sound** (`frontend/assets/sounds/notification.wav`)
   - Duration: < 10 seconds
   - Format: WAV
   - Pleasant, not jarring

## Verification Checklist

Before deploying or submitting:

- [ ] All placeholder values replaced
- [ ] API URLs point to production servers
- [ ] Service account JSON downloaded (Android)
- [ ] Apple certificates generated (iOS)
- [ ] Legal addresses filled in
- [ ] All assets created and placed correctly
- [ ] `.env` file created with production values
- [ ] `.gitignore` includes sensitive files
- [ ] Test build runs successfully
- [ ] Legal documents reviewed by counsel

## Security Notes

**Never commit these files to git:**
- `.env` files
- `google-play-service-account.json`
- Apple certificates (.p12, .mobileprovision)
- Any file containing API keys or secrets

**Add to .gitignore:**
```gitignore
# Environment variables
.env
.env.local
.env.production

# Google Play
google-play-service-account.json

# Apple certificates
*.p12
*.mobileprovision

# Expo
.expo/

# Other secrets
credentials.json
secrets/
```

## Getting Help

If you're unsure about any configuration:

1. **Expo Documentation:** https://docs.expo.dev/
2. **Apple Developer:** https://developer.apple.com/
3. **Google Play Console:** https://play.google.com/console/
4. **Sentry Setup:** https://docs.sentry.io/platforms/react-native/

## Quick Setup Commands

```bash
# Initialize Expo project ID
cd frontend
eas init

# Generate Apple credentials
eas credentials

# Configure updates
eas update:configure

# Test production build
eas build --platform ios --profile production --local
eas build --platform android --profile production --local

# Submit to stores (after builds complete)
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

**Remember:** Test everything in development/staging before using production values!
