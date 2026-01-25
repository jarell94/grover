# Backend Refactoring Plan

## Current State
- **File**: `backend/server.py`
- **Lines**: 4740+ (monolithic)
- **Status**: Functional but unmaintainable
- **Issues**:
  - Single 4700+ line file containing all routes, models, Socket.IO handlers
  - Mixed concerns (auth, posts, comments, messaging, payments, notifications, etc.)
  - Difficult to test individual features
  - Hard to onboard new developers
  - Performance monitoring scattered throughout
  - Error handling inconsistent

## Target Architecture

### Directory Structure
```
backend/
├── server.py           # Main app initialization
├── config.py          # Configuration management
├── models/
│   ├── __init__.py
│   ├── user.py       # User, Profile, Subscription models
│   ├── post.py       # Post, Comment, Reaction models
│   ├── message.py    # Message, Conversation models
│   ├── payment.py    # Order, Payment, Transaction models
│   ├── stream.py     # Stream, StreamViewer models
│   └── story.py      # Story, StoryViewer models
├── routers/
│   ├── __init__.py
│   ├── auth.py       # Authentication endpoints (~250 lines)
│   ├── posts.py      # Post CRUD, feed (~400 lines)
│   ├── comments.py   # Comment system (~200 lines)
│   ├── messages.py   # Chat, conversations (~300 lines)
│   ├── payments.py   # PayPal, orders (~250 lines)
│   ├── notifications.py # Notifications (~150 lines)
│   ├── analytics.py   # Analytics endpoints (~150 lines)
│   ├── stories.py    # Stories (~200 lines)
│   ├── streaming.py  # Live streaming REST (~250 lines)
│   ├── collections.py # Collections (~200 lines)
│   ├── communities.py # Communities (~200 lines)
│   ├── search.py     # Search endpoints (~100 lines)
│   └── users.py      # User profiles (~200 lines)
├── socket_handlers/
│   ├── __init__.py
│   ├── streaming.py  # Stream Socket.IO handlers
│   ├── messaging.py  # Message Socket.IO handlers
│   └── events.py     # Shared event handling
├── services/
│   ├── __init__.py
│   ├── user_service.py       # User operations
│   ├── post_service.py       # Post operations
│   ├── comment_service.py    # Comment operations
│   ├── notification_service.py # Notification creation
│   ├── payment_service.py    # Payment processing
│   └── stream_service.py     # Stream operations
├── utils/
│   ├── __init__.py
│   ├── security.py   # ID validation, sanitization
│   ├── media.py      # Media upload/processing
│   ├── time.py       # Time utilities
│   ├── errors.py     # Custom exceptions
│   └── constants.py  # All constants
├── middleware/
│   ├── __init__.py
│   └── auth.py       # Auth dependency injection
├── requirements.txt
├── .env
└── .env.example
```

## Migration Strategy

### Phase 1: Setup Infrastructure
1. Create new directory structure
2. Move constants to `utils/constants.py`
3. Create `config.py` for environment loading
4. Create custom exception classes in `utils/errors.py`

### Phase 2: Extract Models
1. Move Pydantic models to appropriate files in `models/`
2. Keep model structure but organize by domain
3. Fix Pydantic V1 `@validator` deprecations → `@field_validator`

### Phase 3: Extract Services
1. Create service classes for each domain
2. Move business logic from routes into services
3. Services handle DB operations, validation, notifications

### Phase 4: Extract Routers
1. Create APIRouter instances in each router file
2. Move endpoints from server.py
3. Update authentication dependencies

### Phase 5: Extract Socket.IO Handlers
1. Create separate socket_handlers modules
2. Migrate stream/message handlers
3. Maintain stream_viewers dictionary in streaming module

### Phase 6: Update Main Server
1. server.py becomes clean initialization
2. Import routers and include them
3. Setup Socket.IO with migrated handlers
4. Setup middleware and CORS

## Key Principles

- **Single Responsibility**: Each module has one clear purpose
- **Reusability**: Services can be imported by multiple routers
- **Testability**: Individual modules can be tested independently
- **Consistency**: All routers follow same pattern
- **Documentation**: Clear docstrings on services and routers

## Dependencies Between Modules

```
server.py (imports and configures everything)
├── config.py (loads environment)
├── models/* (data structures)
├── utils/* (helpers)
├── services/* (business logic, imports models & utils)
├── routers/* (endpoints, imports services & models)
└── socket_handlers/* (real-time, imports services & models)
```

## Migration Checklist

- [ ] Phase 1: Create directories and move constants
- [ ] Phase 2: Extract and organize models
- [ ] Phase 3: Create service classes
- [ ] Phase 4: Extract routers (start with auth)
- [ ] Phase 5: Extract Socket.IO handlers
- [ ] Phase 6: Update server.py
- [ ] Phase 7: Test all endpoints
- [ ] Phase 8: Update API documentation
- [ ] Phase 9: Performance testing
- [ ] Phase 10: Deploy and monitor

## Expected Benefits

1. **Maintainability**: 40+ developers can work independently
2. **Testability**: Unit test individual services
3. **Performance**: Better code organization enables optimization
4. **Documentation**: Clear module purposes
5. **Debugging**: Easier to isolate issues
6. **Onboarding**: New devs understand codebase faster

## Timeline Estimate

- Phase 1: 1 hour
- Phase 2: 2 hours
- Phase 3: 3 hours
- Phase 4: 4 hours
- Phase 5: 2 hours
- Phase 6: 1 hour
- Testing & fixes: 2 hours

**Total: ~15 hours** (can be done in 2-3 sessions)

## Tools/Commands

```bash
# Create structure
mkdir -p backend/{models,routers,socket_handlers,services,utils,middleware}
touch backend/{models,routers,socket_handlers,services,utils,middleware}/__init__.py

# Run tests after each phase
python -m pytest tests/ -v

# Check imports
python -c "import backend.server"

# Start server
python backend/server.py
```

## Next Steps

1. Create directory structure
2. Move constants first (simple, no dependencies)
3. Extract models (depends on constants)
4. Extract services (depends on models)
5. Extract routers (depends on services)
6. Merge all into server.py
