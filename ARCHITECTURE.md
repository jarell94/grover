# Architecture Guide

## System Architecture Overview

Grover is a full-stack social media creator platform with a mobile-first architecture.

```
┌──────────────────────────────────────────────────────────────┐
│                      Client Layer                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React Native App (iOS/Android)                        │  │
│  │  - Expo Router                                         │  │
│  │  - Zustand State Management                            │  │
│  │  - Socket.IO Client                                    │  │
│  │  - Agora RTC SDK                                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
                            ↕ WebSocket
┌──────────────────────────────────────────────────────────────┐
│                      API Layer                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  FastAPI Server                                        │  │
│  │  - REST API Endpoints                                  │  │
│  │  - Socket.IO Server                                    │  │
│  │  - Rate Limiting                                       │  │
│  │  - Authentication                                      │  │
│  │  - Input Validation                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            ↕ Async I/O
┌──────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Posts &   │  │  Live       │  │ Marketplace │          │
│  │   Social    │  │  Streaming  │  │  & Orders   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Messaging  │  │   PayPal    │  │   Media     │          │
│  │  & Chat     │  │  Payments   │  │  Service    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────┐
│                      Data Layer                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MongoDB (Motor async driver)                          │  │
│  │  - Users, Posts, Comments                              │  │
│  │  - Messages, Conversations                             │  │
│  │  - Live Streams, Orders                                │  │
│  │  - 20+ Collections with Indexes                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   External Services                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Cloudinary  │  │   PayPal    │  │    Agora    │          │
│  │  (Media)    │  │  (Payments) │  │  (Streams)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐                            │
│  │   Sentry    │  │    Redis    │                            │
│  │ (Monitoring)│  │   (Cache)   │                            │
│  └─────────────┘  └─────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture

```
frontend/
├── app/                      # Expo Router screens
│   ├── (tabs)/              # Main tab navigation
│   │   ├── index.tsx        # Home feed
│   │   ├── search.tsx       # Search & discovery
│   │   ├── create.tsx       # Content creation
│   │   ├── messages.tsx     # Messaging inbox
│   │   └── profile.tsx      # User profile
│   ├── (auth)/              # Authentication screens
│   ├── (modals)/            # Modal screens
│   └── _layout.tsx          # Root layout
│
├── components/              # Reusable UI components
│   ├── PostCard.tsx         # Post display
│   ├── CommentItem.tsx      # Comment component
│   ├── UserCard.tsx         # User profile card
│   └── ...
│
├── contexts/                # React contexts
│   ├── AuthContext.tsx      # Authentication state
│   └── SocketContext.tsx    # WebSocket connection
│
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts           # Auth hooks
│   ├── usePosts.ts          # Post management
│   └── useSocket.ts         # WebSocket hooks
│
├── services/                # API clients
│   ├── api.ts               # REST API client
│   ├── socket.ts            # Socket.IO client
│   └── storage.ts           # Local storage
│
└── utils/                   # Utility functions
    ├── formatting.ts        # Date/text formatting
    └── validation.ts        # Input validation
```

### Backend Architecture

```
backend/
├── server.py               # Main FastAPI application
│   ├── API Routes          # RESTful endpoints
│   ├── WebSocket Server    # Real-time messaging
│   └── Database Init       # MongoDB connection
│
├── rate_limiter.py         # Rate limiting configuration
├── security_utils.py       # Security helpers
├── logging_config.py       # Structured logging
│
├── Services/
│   ├── media_service.py    # Cloudinary/S3 integration
│   ├── paypal_service.py   # Payment processing
│   ├── paypal_payout_service.py  # Creator payouts
│   └── performance_monitor.py    # Performance tracking
│
└── Utils/
    ├── query_analyzer.py   # Query optimization
    └── db_optimize.py      # Database utilities
```

## Data Flow

### 1. User Posts a New Post

```
Mobile App → REST API → Validation → Security Check → MongoDB
                                                         ↓
                                                    Save Post
                                                         ↓
                                                    Return ID
                                                         ↓
Socket.IO ← Broadcast ← Followers Query ← Get Followers
    ↓
Real-time Notification to Followers
```

### 2. Live Streaming Flow

```
Creator App → Request Token → FastAPI → Agora Token Builder
                                            ↓
                                       Return Token
                                            ↓
Start Stream → Agora RTC → Save Stream Record → MongoDB
                              ↓
                         Notify Followers
                              ↓
Viewer Joins → Request Token → Verify → Join Channel
```

### 3. Message Delivery

```
Sender App → Socket.IO Event → Server Validates
                                      ↓
                                  Save to DB
                                      ↓
                            Recipient Online?
                               ↙         ↘
                            YES           NO
                             ↓             ↓
                    Push via Socket    Store for Later
```

## Database Schema

### Key Collections

**users**
- `_id`: ObjectId
- `username`: string (unique, indexed)
- `email`: string (unique, indexed)
- `profile_picture`: string (URL)
- `bio`: string
- `followers_count`: int
- `following_count`: int
- `created_at`: datetime (indexed)

**posts**
- `_id`: ObjectId
- `user_id`: ObjectId (indexed)
- `content`: string
- `media_urls`: array of strings
- `media_types`: array of strings
- `like_count`: int
- `comment_count`: int
- `created_at`: datetime (indexed)
- `tags`: array of strings (indexed)
- `location`: object (geospatial index)

**comments**
- `_id`: ObjectId
- `post_id`: ObjectId (indexed)
- `user_id`: ObjectId (indexed)
- `content`: string
- `parent_comment_id`: ObjectId (optional, for replies)
- `like_count`: int
- `created_at`: datetime (indexed)

**messages**
- `_id`: ObjectId
- `conversation_id`: ObjectId (indexed)
- `sender_id`: ObjectId (indexed)
- `content`: string
- `media_url`: string (optional)
- `read`: boolean
- `created_at`: datetime (indexed)

**live_streams**
- `_id`: ObjectId
- `host_id`: ObjectId (indexed)
- `title`: string
- `status`: string (scheduled, live, ended)
- `viewer_count`: int
- `scheduled_time`: datetime
- `start_time`: datetime
- `end_time`: datetime

### Indexes Strategy

High-performance queries are achieved through strategic indexing:

1. **Compound Indexes**: For queries filtering by multiple fields
   - `{user_id: 1, created_at: -1}` on posts
   - `{conversation_id: 1, created_at: -1}` on messages

2. **Text Indexes**: For search functionality
   - Full-text search on post content
   - Username and display name search

3. **Geospatial Indexes**: For location-based features
   - 2dsphere index on post locations

## Security Architecture

### Authentication Flow

```
User Login → FastAPI Endpoint
                ↓
         Validate Credentials
                ↓
         Generate Session Token
                ↓
         Store in MongoDB
                ↓
    Return Token to Client
                ↓
    Client Stores in Secure Storage
                ↓
    Attach to All Requests (Header)
```

### Security Layers

1. **Input Validation**
   - Pydantic models for type safety
   - Custom validators for complex rules
   - Size limits on all inputs

2. **Rate Limiting**
   - IP-based rate limits
   - Endpoint-specific limits
   - Redis-backed for distributed systems

3. **Authentication**
   - Session token-based auth
   - 7-day token expiry
   - Secure token generation (UUID)

4. **File Upload Security**
   - MIME type validation
   - File size limits (50MB)
   - Content verification
   - Automatic compression

## Performance Optimization

### Frontend Optimizations

1. **FlashList**: High-performance lists with recycling
2. **Memoization**: React.memo on expensive components
3. **Lazy Loading**: Images and components loaded on demand
4. **Debouncing**: Search and input handlers
5. **CDN**: Cloudinary for fast image delivery

### Backend Optimizations

1. **Database Indexes**: 40+ strategic indexes
2. **Connection Pooling**: Motor async connection pool
3. **Query Optimization**: Projection to limit returned fields
4. **Caching**: Redis for frequently accessed data
5. **Compression**: GZip middleware for responses

### Monitoring & Observability

1. **Sentry Integration**
   - Error tracking with stack traces
   - Performance monitoring
   - Release tracking

2. **Structured Logging**
   - JSON-formatted logs
   - Request/response logging
   - Performance metrics

3. **Performance Monitor**
   - Query timing
   - Endpoint latency
   - Database performance

## Scalability Considerations

### Horizontal Scaling

- **Load Balancing**: Multiple FastAPI instances behind load balancer
- **Session Management**: Redis for distributed sessions
- **File Storage**: Cloudinary CDN for global distribution
- **Database**: MongoDB replica sets for read scaling

### Vertical Scaling

- **Database**: Indexes and query optimization
- **Caching**: Redis for hot data
- **Async I/O**: Non-blocking operations throughout

## Deployment Architecture

### Development
```
Developer Machine
├── Expo Dev Server (Frontend)
└── Uvicorn Dev Server (Backend)
    └── Local MongoDB
```

### Staging
```
Cloud Infrastructure
├── Frontend: Expo Publish
└── Backend: Docker Container
    ├── MongoDB Atlas
    ├── Redis Cache
    └── Cloudinary CDN
```

### Production
```
Cloud Infrastructure (AWS/GCP/Azure)
├── Frontend: Expo EAS Build
│   ├── iOS App Store
│   └── Google Play Store
│
└── Backend: Kubernetes Cluster
    ├── Load Balancer
    ├── Multiple FastAPI Pods
    ├── MongoDB Replica Set
    ├── Redis Cluster
    └── External Services
        ├── Cloudinary CDN
        ├── PayPal API
        ├── Agora
        └── Sentry
```

## Error Handling Strategy

1. **Client-Side**: User-friendly error messages
2. **Server-Side**: Detailed logging with Sentry
3. **Network**: Retry logic with exponential backoff
4. **Validation**: Early validation with clear feedback

## Future Architecture Improvements

1. **Microservices**: Split into auth, posts, messaging, streaming services
2. **Event-Driven**: Kafka/RabbitMQ for async communication
3. **GraphQL**: Alternative to REST for flexible queries
4. **CDN**: Add edge caching for API responses
5. **Background Jobs**: Celery for async tasks
