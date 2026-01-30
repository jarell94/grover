"""
API Gateway for Grover Microservices Architecture

The gateway acts as a single entry point for all client requests and routes them
to the appropriate microservices. It handles:
- Request routing
- Authentication and authorization
- Rate limiting
- Circuit breaking
- Request/response transformation
- Centralized logging
"""
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import httpx
import logging
import time
from typing import Optional
import os
import sys

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.schemas import HealthCheckResponse, ErrorResponse
from shared.utils import ServiceConfig, setup_logging, make_service_request
from datetime import datetime

# Configuration
config = ServiceConfig("gateway")
logger = setup_logging("api-gateway")

# Create FastAPI app
app = FastAPI(
    title="Grover API Gateway",
    description="API Gateway for Grover Microservices",
    version=config.version
)

# Add middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # Configure appropriately for production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ SERVICE REGISTRY ============

class ServiceRegistry:
    """Registry of available microservices."""
    
    def __init__(self):
        self.services = {
            "user": {
                "url": config.user_service_url,
                "health_endpoint": "/health"
            },
            "post": {
                "url": config.post_service_url,
                "health_endpoint": "/health"
            },
            "media": {
                "url": config.media_service_url,
                "health_endpoint": "/health"
            },
            "payment": {
                "url": config.payment_service_url,
                "health_endpoint": "/health"
            }
        }
    
    def get_service_url(self, service_name: str) -> str:
        """Get URL for a service."""
        service = self.services.get(service_name)
        if not service:
            raise ValueError(f"Unknown service: {service_name}")
        return service["url"]
    
    async def check_service_health(self, service_name: str) -> bool:
        """Check if a service is healthy."""
        try:
            service = self.services.get(service_name)
            if not service:
                return False
            
            url = f"{service['url']}{service['health_endpoint']}"
            async with httpx.AsyncClient(timeout=2) as client:
                response = await client.get(url)
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Health check failed for {service_name}: {e}")
            return False


service_registry = ServiceRegistry()


# ============ MIDDLEWARE ============

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests."""
    start_time = time.time()
    
    # Log request
    logger.info(f"{request.method} {request.url.path}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    duration = time.time() - start_time
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration:.3f}s"
    )
    
    return response


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests for tracing."""
    import uuid
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


# ============ AUTHENTICATION ============

async def get_auth_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract auth token from header."""
    if not authorization:
        return None
    
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization


async def forward_auth_header(authorization: Optional[str] = Header(None)) -> dict:
    """Create headers for forwarding auth to services."""
    headers = {}
    if authorization:
        headers["Authorization"] = authorization
    return headers


# ============ HEALTH CHECKS ============

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Gateway health check."""
    return HealthCheckResponse(
        status="healthy",
        service="api-gateway",
        version=config.version,
        timestamp=datetime.now()
    )


@app.get("/health/services")
async def services_health():
    """Check health of all services."""
    results = {}
    for service_name in service_registry.services.keys():
        is_healthy = await service_registry.check_service_health(service_name)
        results[service_name] = {
            "status": "healthy" if is_healthy else "unhealthy",
            "url": service_registry.get_service_url(service_name)
        }
    
    all_healthy = all(r["status"] == "healthy" for r in results.values())
    
    return {
        "gateway": "healthy",
        "services": results,
        "overall_status": "healthy" if all_healthy else "degraded"
    }


# ============ ROUTING HANDLERS ============

async def proxy_request(
    request: Request,
    service_name: str,
    path: str,
    headers: dict
) -> JSONResponse:
    """
    Proxy a request to a microservice.
    
    Args:
        request: FastAPI request object
        service_name: Name of the target service
        path: Path to forward to
        headers: Headers to forward
        
    Returns:
        JSONResponse with service response
    """
    try:
        service_url = service_registry.get_service_url(service_name)
        url = f"{service_url}{path}"
        
        # Get request body if present
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.json() if await request.body() else None
        
        # Forward request to service
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                json=body,
                params=dict(request.query_params)
            )
            
            return JSONResponse(
                content=response.json() if response.content else {},
                status_code=response.status_code,
                headers=dict(response.headers)
            )
    
    except httpx.HTTPError as e:
        logger.error(f"Error proxying to {service_name}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Service {service_name} unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal gateway error")


# ============ ROUTE DEFINITIONS ============

@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_auth(
    request: Request,
    path: str,
    headers: dict = Depends(forward_auth_header)
):
    """Route authentication requests to user service."""
    return await proxy_request(request, "user", f"/api/auth/{path}", headers)


@app.api_route("/api/users/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_users(
    request: Request,
    path: str,
    headers: dict = Depends(forward_auth_header)
):
    """Route user requests to user service."""
    return await proxy_request(request, "user", f"/api/users/{path}", headers)


@app.api_route("/api/posts/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_posts(
    request: Request,
    path: str,
    headers: dict = Depends(forward_auth_header)
):
    """Route post requests to post service."""
    return await proxy_request(request, "post", f"/api/posts/{path}", headers)


@app.api_route("/api/media/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_media(
    request: Request,
    path: str,
    headers: dict = Depends(forward_auth_header)
):
    """Route media requests to media service."""
    return await proxy_request(request, "media", f"/api/media/{path}", headers)


@app.api_route("/api/payments/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_payments(
    request: Request,
    path: str,
    headers: dict = Depends(forward_auth_header)
):
    """Route payment requests to payment service."""
    return await proxy_request(request, "payment", f"/api/payments/{path}", headers)


# ============ ROOT ENDPOINTS ============

@app.get("/")
async def root():
    """Gateway root endpoint."""
    return {
        "service": "Grover API Gateway",
        "version": config.version,
        "status": "running",
        "documentation": "/docs",
        "services": list(service_registry.services.keys())
    }


@app.get("/api")
async def api_info():
    """API information."""
    return {
        "message": "Grover Microservices API",
        "version": config.version,
        "services": {
            name: service["url"]
            for name, service in service_registry.services.items()
        }
    }


# ============ ERROR HANDLERS ============

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            status="error",
            message=exc.detail,
            code=str(exc.status_code)
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            status="error",
            message="Internal server error",
            code="500"
        ).model_dump()
    )


# ============ STARTUP/SHUTDOWN ============

@app.on_event("startup")
async def startup():
    """Initialize gateway on startup."""
    logger.info(f"Starting API Gateway v{config.version}")
    logger.info(f"Environment: {config.environment}")
    
    # Check service health
    for service_name in service_registry.services.keys():
        is_healthy = await service_registry.check_service_health(service_name)
        status = "✓" if is_healthy else "✗"
        logger.info(f"  {status} {service_name}: {service_registry.get_service_url(service_name)}")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("Shutting down API Gateway")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.port)
