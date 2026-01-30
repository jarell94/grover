# Grover - Social Media Creator Platform

A modern social media platform built with FastAPI and MongoDB, featuring both a modular monolith and microservices architecture.

## 🎉 Recent Updates

### Microservices Architecture (Latest) 🚀
The application now includes a complete microservices implementation with:
- **API Gateway** - Single entry point for all requests
- **User Service** - Authentication and profile management
- **Post Service** - Posts, feed, and social interactions
- **Docker Support** - Full containerization with docker-compose

**See [microservices/README.md](./microservices/README.md) for quick start and [microservices/ARCHITECTURE.md](./microservices/ARCHITECTURE.md) for details.**

### Modular Monolith Refactoring
The backend was refactored from a monolithic structure (~5,900 lines) into a clean, modular, layered architecture. 

**See [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) for complete details.**

## 📁 Project Structure

```
grover/
├── microservices/        # Microservices architecture (NEW)
│   ├── gateway/         # API Gateway (Port 8000)
│   ├── user-service/    # User management (Port 8001)
│   ├── post-service/    # Post management (Port 8002)
│   ├── shared/          # Common utilities
│   ├── ARCHITECTURE.md  # Microservices documentation
│   ├── README.md        # Quick start guide
│   └── MIGRATION_GUIDE.md # Migration strategies
│
├── backend/              # Modular monolith (refactored)
│   ├── core/            # Configuration, database, security
│   ├── schemas/         # Pydantic data models
│   ├── repositories/    # Database access layer
│   ├── services/        # Business logic layer
│   ├── routers/         # API route handlers
│   ├── tests/           # Test suite
│   ├── server_new.py    # New modular server
│   ├── server_old.py    # Original monolithic server (backup)
│   └── ARCHITECTURE.md  # Architecture documentation
│
├── frontend/            # Frontend application
├── tests/               # Project-level tests
├── docker-compose.yml   # Microservices orchestration
└── REFACTORING_SUMMARY.md  # Refactoring details
```

## 🚀 Quick Start

### Option 1: Microservices with Docker (Recommended)

```bash
# Start all services with one command
docker-compose up -d

# Check service health
curl http://localhost:8000/health/services

# Access API Gateway
# - API: http://localhost:8000/api
# - Docs: http://localhost:8000/docs
# - Health: http://localhost:8000/health

# Stop services
docker-compose down
```

### Option 2: Modular Monolith

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (create .env file)
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_db

# Run the new modular server
uvicorn server_new:socket_app --reload --port 8000
```

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=backend --cov-report=html

# Run specific test categories
pytest -m unit          # Unit tests only
pytest -m service       # Service layer tests
pytest -m integration   # Integration tests
```

## 📚 Documentation

### Microservices
- **[microservices/README.md](./microservices/README.md)** - Quick start guide for microservices
- **[microservices/ARCHITECTURE.md](./microservices/ARCHITECTURE.md)** - Microservices architecture details
- **[microservices/MIGRATION_GUIDE.md](./microservices/MIGRATION_GUIDE.md)** - Migration strategies

### Modular Monolith
- **[backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md)** - Monolith architecture documentation
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - Refactoring details and metrics

### API Documentation
- **Gateway**: http://localhost:8000/docs (microservices)
- **Monolith**: http://localhost:8000/docs (modular monolith)

## 🏗️ Architecture

### Microservices Architecture (Latest)

The platform now supports a microservices architecture with independent services:

```
                    ┌─────────────┐
                    │   Clients   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ API Gateway │  Port 8000
                    │  (Routing)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │  User   │      │  Post   │      │  Media  │
    │ Service │      │ Service │      │ Service │
    │  :8001  │      │  :8002  │      │  :8003  │
    └────┬────┘      └────┬────┘      └─────────┘
         │                │
    ┌────▼────┐      ┌────▼────┐
    │MongoDB  │      │MongoDB  │
    │ (users) │      │ (posts) │
    └─────────┘      └─────────┘
```

**Benefits**:
- Independent deployment and scaling
- Technology flexibility per service
- Team autonomy
- Fault isolation

### Modular Monolith Architecture

The backend follows a clean layered architecture:

```
┌─────────────────────┐
│   Routers (API)     │  FastAPI route handlers
├─────────────────────┤
│   Services          │  Business logic
├─────────────────────┤
│   Repositories      │  Data access
├─────────────────────┤
│   Database          │  MongoDB
└─────────────────────┘
```

### Key Features

- ✅ **Modular Architecture**: Clear separation of concerns
- ✅ **Type Safety**: Full type hints with Pydantic
- ✅ **Testing**: Comprehensive test suite with pytest
- ✅ **Security**: Input validation and sanitization
- ✅ **Documentation**: Auto-generated API docs
- ✅ **Dependency Injection**: FastAPI's Depends pattern

## 🔧 Technology Stack

### Backend
- **Framework**: FastAPI 0.110.1
- **Database**: MongoDB (Motor async driver)
- **Auth**: OAuth with session management
- **Real-time**: Socket.IO
- **Testing**: Pytest with async support
- **Validation**: Pydantic 2.12.5

### Integrations
- **Media**: Cloudinary
- **Payments**: PayPal
- **Live Streaming**: Agora
- **Monitoring**: Sentry

## 🎯 Features

### Implemented (Modular)
- ✅ User authentication and profile management
- ✅ Follow/unfollow system
- ✅ Post creation and management
- ✅ Social interactions (likes, reactions, saves)
- ✅ Feed and explore pages
- ✅ User and post search

### Available (Legacy Server)
- Comments with threaded replies
- Direct messages and group chats
- Product marketplace
- Live streaming
- Stories and highlights
- Collections and bookmarks
- Analytics and insights
- Premium subscriptions
- And much more...

## 📈 Migration Status

**Completed**: 27 endpoints across 3 domains (Auth, Users, Posts)
**Remaining**: ~113 endpoints across 10+ domains

See [ARCHITECTURE.md](./backend/ARCHITECTURE.md) for migration patterns.

## 🧪 Testing

The project includes:
- Unit tests for service layer
- Integration tests for API endpoints
- Test fixtures for common scenarios
- Mock database for isolated testing

Test coverage: Services layer has comprehensive unit tests.

## 🔒 Security

- Input validation on all endpoints
- XSS protection with sanitization
- File upload validation
- SQL injection prevention (NoSQL)
- Security scanning with CodeQL

## 🤝 Contributing

When adding new features:

1. Follow the established layered architecture
2. Create schema → repository → service → router
3. Write tests for your changes
4. Update documentation
5. Run security checks

See [ARCHITECTURE.md](./backend/ARCHITECTURE.md) for detailed guidelines.

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

This refactoring establishes a solid foundation for future development with:
- Clean architecture patterns
- Comprehensive testing infrastructure
- Security best practices
- Complete documentation
