# Grover - Social Media Creator Platform

A modern social media platform built with FastAPI and MongoDB, featuring a clean modular architecture.

## 🎉 Recent Refactoring

The backend has been successfully refactored from a monolithic structure (~5,900 lines) into a clean, modular, layered architecture. 

**See [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) for complete details.**

## 📁 Project Structure

```
grover/
├── backend/              # FastAPI backend (refactored)
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
└── REFACTORING_SUMMARY.md  # Refactoring details

```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (create .env file)
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_db

# Run the new modular server
uvicorn server_new:socket_app --reload --port 8000

# Or run the old monolithic server
uvicorn server_old:socket_app --reload --port 8001
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

- **[ARCHITECTURE.md](./backend/ARCHITECTURE.md)** - Complete architecture documentation
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - Refactoring details and metrics
- **API Docs**: http://localhost:8000/docs (when server is running)

## 🏗️ Architecture

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
