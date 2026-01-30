"""
Shared utility functions for microservices.
"""
import os
import logging
from typing import Optional
import httpx
from datetime import datetime


def setup_logging(service_name: str) -> logging.Logger:
    """Setup logging for a microservice."""
    logging.basicConfig(
        level=logging.INFO,
        format=f'%(asctime)s - {service_name} - %(levelname)s - %(message)s'
    )
    return logging.getLogger(service_name)


async def make_service_request(
    service_url: str,
    endpoint: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    json_data: Optional[dict] = None,
    timeout: int = 10
) -> dict:
    """
    Make HTTP request to another microservice.
    
    Args:
        service_url: Base URL of the service
        endpoint: API endpoint path
        method: HTTP method (GET, POST, PUT, DELETE)
        headers: Optional headers
        json_data: Optional JSON payload
        timeout: Request timeout in seconds
        
    Returns:
        Response data as dict
        
    Raises:
        httpx.HTTPError: If request fails
    """
    url = f"{service_url}{endpoint}"
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=json_data)
        elif method == "PUT":
            response = await client.put(url, headers=headers, json=json_data)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return response.json()


def get_service_url(service_name: str) -> str:
    """
    Get service URL from environment variables.
    
    Args:
        service_name: Name of the service (e.g., 'user', 'post', 'media')
        
    Returns:
        Service URL
    """
    env_var = f"{service_name.upper()}_SERVICE_URL"
    default_port = {
        "user": 8001,
        "post": 8002,
        "media": 8003,
        "payment": 8004,
        "notification": 8005
    }.get(service_name.lower(), 8000)
    
    return os.getenv(env_var, f"http://localhost:{default_port}")


class ServiceConfig:
    """Configuration for microservices."""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.version = os.getenv("SERVICE_VERSION", "1.0.0")
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.port = int(os.getenv("PORT", "8000"))
        
        # Service URLs
        self.gateway_url = os.getenv("GATEWAY_URL", "http://localhost:8000")
        self.user_service_url = get_service_url("user")
        self.post_service_url = get_service_url("post")
        self.media_service_url = get_service_url("media")
        self.payment_service_url = get_service_url("payment")
        
        # Database
        self.mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        self.db_name = os.getenv("DB_NAME", f"{service_name}_db")
        
        # Security
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-production")
        self.jwt_algorithm = "HS256"
        
    def __repr__(self):
        return f"ServiceConfig(service={self.service_name}, env={self.environment})"
