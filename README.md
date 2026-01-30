# Grover - Social Media Creator Platform

A comprehensive full-stack social media application built for creators, featuring live streaming, marketplace functionality, direct messaging, and monetization tools.

## 🌟 Features

### Core Social Features
- **Posts & Interactions**: Create, edit, and delete posts with images/videos
- **Engagement**: Like, dislike, comment, repost, save, and share posts
- **Social Graph**: Follow/unfollow users, user profiles with bio and stats
- **Collections**: Organize saved posts into collections
- **Search**: Discover users, posts, and content by tags and locations
- **Stories**: Create time-limited stories (24-hour auto-expiry)
- **Mentions & Tagging**: Tag users in posts and comments

### Live Streaming
- **Agora Integration**: High-quality live video streaming
- **Stream Scheduling**: Schedule and manage upcoming streams
- **Viewer Management**: Track viewers, manage chat, and interactions
- **Multi-Host Support**: Co-hosting and guest streaming capabilities

### Marketplace
- **Product Listings**: Create and manage product catalogs
- **Order Management**: Process orders, track fulfillment
- **Discount Codes**: Create promotional offers
- **Seller Analytics**: Track sales performance and revenue

### Messaging
- **Direct Messages**: One-on-one and group conversations
- **Real-time Chat**: WebSocket-powered instant messaging
- **Voice & Video Messages**: Send audio and video clips
- **Message Reactions**: React to messages with emojis

### Monetization
- **PayPal Integration**: Seamless payment processing
- **Creator Payouts**: Automated earnings distribution
- **Subscription Tiers**: Offer premium content and perks
- **Marketplace Sales**: Revenue from product sales

### Communities
- **Create Communities**: Build niche interest groups
- **Member Management**: Moderate members, set permissions
- **Community Content**: Dedicated feeds for community posts

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React Native 0.79.5 + Expo 54
- TypeScript 5.8 (strict mode)
- Expo Router (file-based navigation)
- Zustand (state management)
- Socket.IO Client (real-time)
- Agora RTC SDK (live streaming)
- Sentry (error tracking)

**Backend:**
- FastAPI (async Python web framework)
- Motor (async MongoDB driver)
- Socket.IO (real-time WebSocket server)
- Pydantic (data validation)
- Uvicorn (ASGI server)

**Database:**
- MongoDB (document database)
- 20+ collections for users, posts, messages, streams, etc.
- Comprehensive indexing for performance

**Infrastructure:**
- Cloudinary (primary media storage)
- AWS S3 (backup media storage)
- PayPal REST SDK (payments)
- Sentry (monitoring & error tracking)

### Project Structure

```
grover/
├── frontend/                 # React Native mobile app
│   ├── app/                 # Expo Router screens
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API clients and services
│   └── utils/               # Utility functions
│
├── backend/                 # FastAPI server
│   ├── server.py           # Main application (API routes)
│   ├── rate_limiter.py     # Rate limiting middleware
│   ├── security_utils.py   # Security validation helpers
│   ├── logging_config.py   # Structured logging setup
│   ├── media_service.py    # Cloudinary/S3 integration
│   ├── paypal_service.py   # PayPal payment handling
│   ├── paypal_payout_service.py  # Creator payout processing
│   ├── performance_monitor.py    # Performance tracking
│   ├── query_analyzer.py   # Database query optimization
│   └── requirements.txt    # Python dependencies
│
├── tests/                   # Backend test suites
│   ├── comprehensive_backend_test.py
│   ├── test_collections.py
│   └── test_reactions.py
│
├── SECURITY_FIXES.md       # Security improvements log
├── BUGS_FIXED.md          # Bug fixes log
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm/yarn
- Python 3.12+
- MongoDB instance
- Expo CLI (`npm install -g expo-cli`)
- (Optional) Expo Go app on mobile device

### Backend Setup

1. **Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configure environment variables:**
Create a `.env` file in the backend directory:
```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover

# Security
SECRET_KEY=your-secret-key-here

# Media Storage (choose one)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# AWS S3 (optional backup)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# PayPal
PAYPAL_MODE=sandbox  # or 'live'
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-client-secret

# Agora (live streaming)
AGORA_APP_ID=your-app-id
AGORA_APP_CERTIFICATE=your-certificate

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn
ENVIRONMENT=development

# CORS
ALLOWED_ORIGINS=http://localhost:19006,exp://192.168.1.100:8081

# Redis (for rate limiting - optional)
REDIS_URL=redis://localhost:6379
```

3. **Run the backend server:**
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
# or
yarn install
```

2. **Configure environment:**
Create a `.env` file in the frontend directory:
```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=http://localhost:8000
EXPO_PUBLIC_AGORA_APP_ID=your-app-id
```

3. **Start the Expo development server:**
```bash
npm start
# or
yarn start
```

4. **Run on device/simulator:**
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app (mobile)

## 🧪 Testing

### Backend Tests

Run all backend tests:
```bash
cd backend
pytest
```

Run specific test suites:
```bash
# Test comments and interactions
pytest comprehensive_backend_test.py

# Test collections feature
pytest test_collections.py

# Test reactions (likes/dislikes)
pytest test_reactions.py
```

### Frontend Tests

Frontend testing infrastructure is currently being set up with Jest and React Testing Library.

## 📊 Performance & Optimization

### Database Optimization
- **40+ Indexes**: Comprehensive indexing on frequently queried fields
- **Query Analyzer**: Built-in tool for identifying slow queries
- **Performance Monitor**: Real-time performance tracking

### Rate Limiting
- **DDoS Protection**: IP-based rate limiting on all endpoints
- **Tiered Limits**: Different limits for auth, media, and general endpoints
- **Redis Support**: Optional Redis backend for distributed rate limiting

### Media Optimization
- **CDN Delivery**: Cloudinary CDN for fast global delivery
- **Automatic Compression**: Images optimized on upload
- **Thumbnail Generation**: Multiple sizes for different use cases
- **Lazy Loading**: Progressive loading for better UX

## 🔒 Security

### Implemented Security Features
✅ Input validation and sanitization
✅ File upload validation (type, size, content)
✅ SQL/NoSQL injection prevention
✅ XSS protection
✅ CORS configuration
✅ Rate limiting
✅ Session management with secure tokens
✅ Sentry error tracking (without PII)
✅ HTTPS enforcement (recommended)

### Security Best Practices
- All user input is validated and sanitized
- File uploads are verified by MIME type and content
- Database queries use parameterized inputs
- Sensitive data is never logged
- Error messages don't expose internal details

See [SECURITY_FIXES.md](SECURITY_FIXES.md) for detailed security improvements.

## 📈 Monitoring & Observability

### Sentry Integration
- Real-time error tracking
- Performance monitoring
- Release tracking
- User session replay (without PII)

### Structured Logging
- JSON-formatted logs for easy parsing
- Request/response logging
- Performance metrics
- Error context capture

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run linters: `npm run lint` (frontend) or `black .` (backend)
5. Run tests: `pytest` (backend)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

**Frontend:**
- TypeScript strict mode
- ESLint with Expo config
- Prettier for formatting

**Backend:**
- Black for Python formatting
- Flake8 for linting
- MyPy for type checking
- isort for import sorting

## 📝 API Documentation

The API is fully documented using FastAPI's automatic documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Key Endpoints

**Authentication:**
- `POST /signup` - Create new user account
- `POST /login` - Authenticate user
- `POST /logout` - End session

**Posts:**
- `GET /posts` - Get feed of posts
- `POST /posts` - Create new post
- `GET /posts/{post_id}` - Get specific post
- `PUT /posts/{post_id}` - Update post
- `DELETE /posts/{post_id}` - Delete post

**Social:**
- `POST /follow` - Follow a user
- `POST /unfollow` - Unfollow a user
- `GET /users/{user_id}` - Get user profile
- `GET /search` - Search users and posts

**Messaging:**
- `GET /messages` - Get conversations
- `POST /messages` - Send message
- WebSocket: `/ws` - Real-time message delivery

See full API documentation at `/docs` endpoint when server is running.

## 🐛 Known Issues & Roadmap

See [BUGS_FIXED.md](BUGS_FIXED.md) for resolved issues.

### Upcoming Features
- [ ] Push notifications (Expo Notifications)
- [ ] Advanced search filters
- [ ] Content moderation tools
- [ ] Analytics dashboard for creators
- [ ] Multiple language support
- [ ] Dark mode themes
- [ ] Offline support with local caching

## 📄 License

This project is private and proprietary. All rights reserved.

## 👥 Support

For questions, issues, or feature requests:
1. Check existing [GitHub Issues](../../issues)
2. Review [API Documentation](http://localhost:8000/docs)
3. Contact the development team

## 🙏 Acknowledgments

- Expo team for the amazing mobile framework
- FastAPI for the high-performance backend framework
- Agora for live streaming technology
- Cloudinary for media management
- MongoDB for flexible data storage
