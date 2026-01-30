"""
Post Service - Microservice for post management

Handles:
- Post CRUD operations
- Feed generation
- Post likes and reactions
- Post search
- Saved posts
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

from shared.schemas import HealthCheckResponse
from shared.utils import ServiceConfig, setup_logging, make_service_request

# Import from backend modules
from repositories.post_repository import PostRepository
from repositories.user_repository import UserRepository
from services.post_service import PostService
from services.auth_service import AuthService
from schemas.user import User
from routers import posts

# Configuration
config = ServiceConfig("post")
logger = setup_logging("post-service")

# Create FastAPI app
app = FastAPI(
    title="Post Service",
    description="Microservice for post management",
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

async def get_post_service(database=Depends(get_database)) -> PostService:
    """Get post service instance."""
    post_repo = PostRepository(database)
    user_repo = UserRepository(database)
    return PostService(post_repo, user_repo)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    database=Depends(get_database)
) -> Optional[User]:
    """
    Get current user from authorization header.
    Validates token with user service.
    """
    if not authorization:
        return None
    
    try:
        # Validate token with user service
        response = await make_service_request(
            config.user_service_url,
            "/api/auth/me",
            headers={"Authorization": authorization}
        )
        
        # Convert response to User object
        user_data = response
        return User(**user_data)
    except Exception as e:
        logger.warning(f"Failed to validate token: {e}")
        return None


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
        service="post-service",
        version=config.version,
        timestamp=datetime.now()
    )


@app.get("/health/db")
async def database_health():
    """Check database connection."""
    try:
        database = await get_database()
        await database.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


@app.get("/health/dependencies")
async def dependencies_health():
    """Check dependencies (user service)."""
    try:
        response = await make_service_request(
            config.user_service_url,
            "/health",
            timeout=5
        )
        user_service_status = response.get("status", "unknown")
    except Exception as e:
        logger.warning(f"User service health check failed: {e}")
        user_service_status = "unhealthy"
    
    return {
        "status": "healthy" if user_service_status == "healthy" else "degraded",
        "dependencies": {
            "user_service": user_service_status
        }
    }


# ============ INCLUDE ROUTERS ============

# Register the posts router
app.include_router(posts.router, prefix="/api")


# ============ ROOT ENDPOINT ============

@app.get("/")
async def root():
    """Service root endpoint."""
    return {
        "service": "Post Service",
        "version": config.version,
        "status": "running",
        "endpoints": {
            "posts": "/api/posts"
        }
    }


# ============ LIFECYCLE EVENTS ============

@app.on_event("startup")
async def startup():
    """Initialize service on startup."""
    global db_client, db
    
    logger.info(f"Starting Post Service v{config.version}")
    logger.info(f"Environment: {config.environment}")
    
    # Connect to database
    try:
        db_client = AsyncIOMotorClient(config.mongo_url)
        db = db_client[config.db_name]
        logger.info(f"Connected to MongoDB: {config.db_name}")
        
        # Create indexes
        await db.posts.create_index("post_id", unique=True)
        await db.posts.create_index("user_id")
        await db.posts.create_index([("created_at", -1)])
        await db.posts.create_index([("likes_count", -1)])
        await db.likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.reactions.create_index([("post_id", 1), ("user_id", 1)])
        await db.saved_posts.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        
        logger.info("Database indexes created")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    global db_client
    
    logger.info("Shutting down Post Service")
    
    if db_client:
        db_client.close()
        logger.info("Database connection closed")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.port)
