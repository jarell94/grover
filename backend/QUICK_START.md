# Quick Start Guide

## Running the Refactored Backend

### Prerequisites
- Python 3.8+
- MongoDB running (or connection string)
- pip installed

### Setup

1. **Install dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configure environment:**
Create a `.env` file in the `backend/` directory:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_db
ENVIRONMENT=development
```

3. **Start the server:**
```bash
# New modular server
uvicorn server_new:socket_app --reload --port 8000

# Old monolithic server (for comparison)
uvicorn server_old:socket_app --reload --port 8001
```

4. **Access the API:**
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health
- API Base: http://localhost:8000/api

## Testing the API

### Using the Swagger UI (Recommended)

1. Open http://localhost:8000/docs
2. Try the following endpoints:

#### Health Check
```
GET /health
```

#### Authentication
```
GET /api/auth/session?session_id=YOUR_SESSION_ID
```

#### Users
```
GET /api/users/{user_id}
GET /api/users/me
POST /api/users/{user_id}/follow
```

#### Posts
```
POST /api/posts/
GET /api/posts/feed/me
GET /api/posts/explore/all
POST /api/posts/{post_id}/like
```

### Using cURL

```bash
# Health check
curl http://localhost:8000/health

# Get media service status
curl http://localhost:8000/api/media/status
```

## Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_user_service.py

# Run with coverage
pytest --cov=backend --cov-report=html
```

## Comparing Old vs New

### Old Server (Monolithic)
```bash
uvicorn server_old:socket_app --reload --port 8001
```
- All 140+ endpoints available
- Single 5,900-line file
- Harder to maintain and test

### New Server (Modular)
```bash
uvicorn server_new:socket_app --reload --port 8000
```
- 27 endpoints migrated (Auth, Users, Posts)
- Modular architecture
- Well-tested and documented

## API Endpoints Available

### Authentication (`/api/auth`)
- `GET /auth/session` - Create session from OAuth
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Users (`/api/users`)
- `GET /users/me` - Get current user profile
- `GET /users/{user_id}` - Get user by ID
- `GET /users/{user_id}/stats` - Get user statistics
- `PUT /users/profile` - Update profile
- `PUT /users/notification-settings` - Update notifications
- `POST /users/{user_id}/follow` - Follow user
- `DELETE /users/{user_id}/follow` - Unfollow user
- `GET /users/{user_id}/followers` - Get followers
- `GET /users/{user_id}/following` - Get following
- `GET /users/search/{query}` - Search users

### Posts (`/api/posts`)
- `POST /posts/` - Create post
- `GET /posts/{post_id}` - Get post
- `PUT /posts/{post_id}` - Update post
- `DELETE /posts/{post_id}` - Delete post
- `GET /posts/user/{user_id}` - Get user's posts
- `GET /posts/feed/me` - Get personalized feed
- `GET /posts/explore/all` - Get explore posts
- `POST /posts/{post_id}/like` - Like post
- `DELETE /posts/{post_id}/like` - Unlike post
- `POST /posts/{post_id}/react` - Add reaction
- `DELETE /posts/{post_id}/react` - Remove reaction
- `POST /posts/{post_id}/save` - Save post
- `DELETE /posts/{post_id}/save` - Unsave post
- `GET /posts/saved/me` - Get saved posts
- `POST /posts/{post_id}/share` - Share post
- `GET /posts/search/{query}` - Search posts

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Import Errors
```bash
# Ensure you're in the backend directory
cd backend

# Reinstall dependencies
pip install -r requirements.txt
```

### Port Already in Use
```bash
# Change the port
uvicorn server_new:socket_app --reload --port 8001
```

## Development Workflow

### Adding a New Feature

1. **Create Schema** (`schemas/feature.py`)
2. **Create Repository** (`repositories/feature_repository.py`)
3. **Create Service** (`services/feature_service.py`)
4. **Create Router** (`routers/feature.py`)
5. **Add Tests** (`tests/test_feature_service.py`)
6. **Register Router** (in `server_new.py`)

See ARCHITECTURE.md for detailed examples.

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture details
- Read [REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md) for migration info
- Explore the API at http://localhost:8000/docs
- Run the tests: `pytest`
- Start migrating more endpoints!
