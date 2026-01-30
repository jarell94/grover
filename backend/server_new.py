"""
Grover FastAPI Application - Modular Architecture

This is the refactored main application file using a layered architecture:
- Core: Configuration, database, security
- Schemas: Pydantic models for data validation
- Repositories: Database access layer
- Services: Business logic layer
- Routers: API route handlers

The old monolithic server.py has been backed up as server_old.py for reference.
"""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
import socketio
import os
import logging

# Core imports
from core.config import settings, logger
from core.database import database

# Router imports
from routers import auth, users, posts

# Third-party integrations
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# Media service integration
from media_service import get_media_service_status

# Initialize Sentry (if configured)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        send_default_pii=False,
        release=settings.APP_VERSION,
    )
    logger.info(f"Sentry initialized for environment: {settings.ENVIRONMENT}")
else:
    logger.warning("SENTRY_DSN not set - error tracking disabled")

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
if ALLOWED_ORIGINS == ["*"]:
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=cors_origins if cors_origins != ["*"] else '*',
    logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Create FastAPI application
app = FastAPI(
    title="Grover API",
    description="Social Media Creator Platform API - Modular Architecture",
    version=settings.APP_VERSION
)

# Add GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Create API router with prefix
api_router = APIRouter(prefix="/api")

# Register routers
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(posts.router)

# Include API router in main app
app.include_router(api_router)


# ============ LIFECYCLE EVENTS ============

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("Starting Grover API...")
    
    # Connect to database
    await database.connect()
    
    # Create database indexes
    await database.create_indexes()
    
    logger.info("Grover API started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("Shutting down Grover API...")
    
    # Disconnect from database
    await database.disconnect()
    
    logger.info("Grover API shut down successfully")


# ============ HEALTH CHECK ENDPOINTS ============

@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Grover API - Modular Architecture",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "api": "/api"
    }


@app.get("/api/media/status")
async def get_media_status():
    """Get media upload service status."""
    return get_media_service_status()


# ============ SOCKET.IO INTEGRATION ============

# Wrap FastAPI app with Socket.IO
socket_app = socketio.ASGIApp(sio, app)


# ============ SOCKET.IO EVENT HANDLERS ============
# Note: Socket.IO handlers for real-time features will be added as needed
# Example handlers for messaging, notifications, live streaming, etc.

@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")


# ============ MAIN APPLICATION EXPORT ============

# Export for ASGI server (uvicorn)
# Use: uvicorn server:socket_app --reload
__all__ = ["app", "socket_app"]


# ============ MIGRATION NOTES ============
"""
MIGRATION STATUS:

✅ Completed:
- Core infrastructure (config, database, security)
- Schemas (user, post, comment, product)
- Repositories (user, post)
- Services (auth, user, post)
- Routers (auth, users, posts)
- Test infrastructure (pytest, conftest, unit tests)

⏳ Remaining to migrate:
- Comments endpoints (CRUD, likes, replies)
- Messages endpoints (DMs, groups, rich messages)
- Products endpoints (CRUD, discounts)
- Orders endpoints (purchases, PayPal integration)
- Notifications endpoints (in-app, push)
- Stories endpoints (CRUD, highlights)
- Live streaming endpoints (Agora, super chat, gifts)
- Collections endpoints (CRUD, bookmarks)
- Analytics endpoints (earnings, engagement)
- Search endpoints (users, posts, hashtags)
- Additional social features (reposts, polls, mentions)

The old monolithic server.py has been backed up as server_old.py.
Gradually migrate remaining endpoints following the established pattern:
1. Define schemas in schemas/
2. Create repository in repositories/
3. Implement business logic in services/
4. Create route handlers in routers/
5. Add tests in tests/
6. Register router in this file
"""
