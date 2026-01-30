"""
User Service - Microservice for user management

Handles:
- User authentication
- User profiles
- Follow/unfollow system
- User search
- User statistics
"""
from fastapi import FastAPI, Depends, HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import sys
import os
from datetime import datetime

# Add paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from shared.schemas import HealthCheckResponse, AuthUser
from shared.utils import ServiceConfig, setup_logging

# Import from backend modules
from repositories.user_repository import UserRepository
from services.auth_service import AuthService
from services.user_service import UserService
from schemas.user import User, UserUpdate, NotificationSettings, UserPublic
from routers import auth, users

# Configuration
config = ServiceConfig("user")
logger = setup_logging("user-service")

# Create FastAPI app
app = FastAPI(
    title="User Service",
    description="Microservice for user management and authentication",
    version=config.version
)

# Database connection
db_client = None
db = None


# ============ DATABASE SETUP ============

async def get_database():
    """Get database instance."""
    global db
    if not db:
        raise RuntimeError("Database not connected")
    return db


# ============ DEPENDENCY INJECTION ============

async def get_auth_service(database=Depends(get_database)) -> AuthService:
    """Get auth service instance."""
    return AuthService(database)


async def get_user_service(database=Depends(get_database)) -> UserService:
    """Get user service instance."""
    user_repo = UserRepository(database)
    return UserService(user_repo)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> Optional[User]:
    """Get current user from authorization header."""
    if not authorization:
        return None
    
    token = authorization.replace("Bearer ", "")
    return await auth_service.get_user_from_token(token)


async def require_auth(current_user: Optional[User] = Depends(get_current_user)) -> User:
    """Require authentication."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user


# ============ HEALTH CHECK ============

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Service health check."""
    return HealthCheckResponse(
        status="healthy",
        service="user-service",
        version=config.version,
        timestamp=datetime.now()
    )


@app.get("/health/db")
async def database_health():
    """Check database connection."""
    try:
        database = await get_database()
        # Ping database
        await database.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# ============ INCLUDE ROUTERS ============

# Register the auth and users routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")


# ============ ROOT ENDPOINT ============

@app.get("/")
async def root():
    """Service root endpoint."""
    return {
        "service": "User Service",
        "version": config.version,
        "status": "running",
        "endpoints": {
            "auth": "/api/auth",
            "users": "/api/users"
        }
    }


# ============ LIFECYCLE EVENTS ============

@app.on_event("startup")
async def startup():
    """Initialize service on startup."""
    global db_client, db
    
    logger.info(f"Starting User Service v{config.version}")
    logger.info(f"Environment: {config.environment}")
    
    # Connect to database
    try:
        db_client = AsyncIOMotorClient(config.mongo_url)
        db = db_client[config.db_name]
        logger.info(f"Connected to MongoDB: {config.db_name}")
        
        # Create indexes
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
        
        logger.info("Database indexes created")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    global db_client
    
    logger.info("Shutting down User Service")
    
    if db_client:
        db_client.close()
        logger.info("Database connection closed")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.port)
