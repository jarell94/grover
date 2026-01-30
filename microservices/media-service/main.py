"""
Media Service - Microservice for file uploads and media processing

Handles:
- File uploads to Cloudinary/S3
- Image optimization and thumbnails
- Video processing
- Media deletion
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional
import sys
import os
from datetime import datetime
import uuid

# Add paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from shared.schemas import HealthCheckResponse
from shared.utils import ServiceConfig, setup_logging

# Import media service logic
from media_service import (
    upload_media,
    delete_media,
    get_media_service_status,
    CLOUDINARY_AVAILABLE,
    S3_AVAILABLE
)

# Configuration
config = ServiceConfig("media")
logger = setup_logging("media-service")

# Create FastAPI app
app = FastAPI(
    title="Media Service",
    description="Microservice for media uploads and processing",
    version=config.version
)


# ============ HEALTH CHECK ============

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Service health check."""
    return HealthCheckResponse(
        status="healthy",
        service="media-service",
        version=config.version,
        timestamp=datetime.now()
    )


@app.get("/health/storage")
async def storage_health():
    """Check storage backends health."""
    return {
        "status": "healthy",
        "backends": {
            "cloudinary": "available" if CLOUDINARY_AVAILABLE else "unavailable",
            "s3": "available" if S3_AVAILABLE else "unavailable"
        }
    }


# ============ MEDIA ENDPOINTS ============

@app.post("/api/media/upload")
async def upload_file(
    file: UploadFile = File(...)
):
    """
    Upload media file.
    
    Supports images and videos.
    Automatically optimizes and generates thumbnails.
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Determine file type
        content_type = file.content_type or ""
        is_video = content_type.startswith("video/")
        
        # Upload to storage
        result = await upload_media(
            file_content,
            filename=file.filename,
            content_type=content_type,
            is_video=is_video
        )
        
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {
            "status": "success",
            "media_url": result.get("url"),
            "media_type": "video" if is_video else "image",
            "thumbnail_url": result.get("thumbnail_url"),
            "public_id": result.get("public_id"),
            "size": len(file_content)
        }
    
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/media/{public_id}")
async def delete_file(public_id: str):
    """
    Delete media file by public ID.
    """
    try:
        result = await delete_media(public_id)
        
        if result.get("error"):
            raise HTTPException(status_code=404, detail=result["error"])
        
        return {
            "status": "success",
            "message": "Media deleted successfully"
        }
    
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/media/status")
async def media_status():
    """Get media service status and configuration."""
    return get_media_service_status()


# ============ ROOT ENDPOINT ============

@app.get("/")
async def root():
    """Service root endpoint."""
    return {
        "service": "Media Service",
        "version": config.version,
        "status": "running",
        "backends": {
            "cloudinary": CLOUDINARY_AVAILABLE,
            "s3": S3_AVAILABLE
        },
        "endpoints": {
            "upload": "POST /api/media/upload",
            "delete": "DELETE /api/media/{public_id}",
            "status": "GET /api/media/status"
        }
    }


# ============ LIFECYCLE EVENTS ============

@app.on_event("startup")
async def startup():
    """Initialize service on startup."""
    logger.info(f"Starting Media Service v{config.version}")
    logger.info(f"Environment: {config.environment}")
    logger.info(f"Cloudinary: {'✓' if CLOUDINARY_AVAILABLE else '✗'}")
    logger.info(f"S3: {'✓' if S3_AVAILABLE else '✗'}")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("Shutting down Media Service")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.port)
