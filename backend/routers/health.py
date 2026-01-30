"""
Health Router - Health check and readiness endpoints
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import os
import logging

from core.database import db
from core.config import AGORA_AVAILABLE

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    Health check endpoint for deployment monitoring.
    Returns status of all services.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "services": {}
    }
    
    # Check MongoDB connection
    try:
        await db.command("ping")
        health_status["services"]["mongodb"] = {"status": "connected"}
    except Exception as e:
        health_status["services"]["mongodb"] = {"status": "disconnected", "error": str(e)}
        health_status["status"] = "degraded"
    
    # Check Cloudinary configuration
    cloudinary_configured = bool(
        os.getenv("CLOUDINARY_CLOUD_NAME") and 
        os.getenv("CLOUDINARY_API_KEY") and 
        os.getenv("CLOUDINARY_API_SECRET")
    )
    health_status["services"]["cloudinary"] = {
        "status": "configured" if cloudinary_configured else "not_configured"
    }
    
    # Check Agora configuration
    health_status["services"]["agora"] = {
        "status": "available" if AGORA_AVAILABLE else "not_available"
    }
    
    # Check PayPal configuration
    paypal_configured = bool(
        os.getenv("PAYPAL_CLIENT_ID") and 
        os.getenv("PAYPAL_CLIENT_SECRET")
    )
    health_status["services"]["paypal"] = {
        "status": "configured" if paypal_configured else "not_configured"
    }
    
    return health_status


@router.get("/ready")
async def readiness_check():
    """
    Readiness check for Kubernetes/deployment.
    Returns 200 only if all critical services are available.
    """
    try:
        # Must have MongoDB connection
        await db.command("ping")
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Service not ready")
