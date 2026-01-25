# Configuration management for Grover backend

import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
BACKEND_DIR = ROOT_DIR
load_dotenv(ROOT_DIR / '.env')

class Settings:
    """Application settings from environment variables"""
    
    # App
    APP_NAME = "Grover"
    APP_VERSION = "1.0.0"
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # Server
    HOST = os.getenv('BACKEND_HOST', '0.0.0.0')
    PORT = int(os.getenv('BACKEND_PORT', '8001'))
    
    # Database
    MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('DB_NAME', 'grover_dev')
    
    # CORS
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')
    
    # Authentication
    JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '30'))
    
    # OAuth (Google)
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    
    # PayPal
    PAYPAL_MODE = os.getenv('PAYPAL_MODE', 'sandbox')  # sandbox or live
    PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID', '')
    PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET', '')
    PAYPAL_SIGNATURE = os.getenv('PAYPAL_SIGNATURE', '')
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
    
    # AWS S3
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
    AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET', '')
    
    # Agora
    AGORA_APP_ID = os.getenv('AGORA_APP_ID', '')
    AGORA_APP_CERTIFICATE = os.getenv('AGORA_APP_CERTIFICATE', '')
    
    # Sentry (Error tracking)
    SENTRY_DSN = os.getenv('SENTRY_DSN', '')
    
    # Email
    SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER = os.getenv('SMTP_USER', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'noreply@grover.app')
    
    # Redis (for caching, sessions)
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
    
    # Rate limiting
    RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'True').lower() == 'true'
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.getenv('RATE_LIMIT_REQUESTS_PER_MINUTE', '60'))
    
    # Features
    ENABLE_PAYMENTS = os.getenv('ENABLE_PAYMENTS', 'False').lower() == 'true'
    ENABLE_LIVE_STREAMING = os.getenv('ENABLE_LIVE_STREAMING', 'True').lower() == 'true'
    ENABLE_STORIES = os.getenv('ENABLE_STORIES', 'True').lower() == 'true'
    ENABLE_COMMUNITIES = os.getenv('ENABLE_COMMUNITIES', 'True').lower() == 'true'
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'grover.log')
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production"""
        return not cls.DEBUG
    
    @classmethod
    def is_development(cls) -> bool:
        """Check if running in development"""
        return cls.DEBUG
    
    @classmethod
    def validate_critical_settings(cls) -> bool:
        """Validate that all critical settings are configured"""
        errors = []
        
        if not cls.MONGO_URL:
            errors.append("MONGO_URL not configured")
        
        if not cls.DB_NAME:
            errors.append("DB_NAME not configured")
        
        if cls.is_production():
            if not cls.JWT_SECRET or cls.JWT_SECRET == 'your-secret-key-change-in-production':
                errors.append("JWT_SECRET must be configured in production")
        
        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(errors))
        
        return True

# Create settings instance
settings = Settings()
