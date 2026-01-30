"""
Configuration Module - Centralized application settings and environment variables
"""
import os
import re
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============ APPLICATION SETTINGS ============
APP_TITLE = "Grover API"
APP_DESCRIPTION = "Social Media Creator Platform API"
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ============ DATABASE SETTINGS ============
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# ============ SECURITY CONSTANTS ============
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB (increased for video uploads to cloud)
MAX_INPUT_LENGTH = 10000  # Max characters for text input
MAX_BIO_LENGTH = 500
MAX_NAME_LENGTH = 100

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_AUDIO_TYPES

# ID validation pattern (alphanumeric with underscores)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

# ============ CORS SETTINGS ============
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# In development, allow all origins; in production, specify domains
if ALLOWED_ORIGINS == ["*"]:
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

# ============ SENTRY SETTINGS ============
SENTRY_DSN = os.getenv("SENTRY_DSN")
SENTRY_TRACES_SAMPLE_RATE = 0.1 if ENVIRONMENT == "production" else 1.0
SENTRY_PROFILES_SAMPLE_RATE = 0.1 if ENVIRONMENT == "production" else 1.0

# ============ AGORA SETTINGS ============
try:
    from agora_token_builder import RtcTokenBuilder
    Role_Publisher = 1
    Role_Subscriber = 2
    AGORA_AVAILABLE = True
except ImportError:
    AGORA_AVAILABLE = False
    Role_Publisher = None
    Role_Subscriber = None

# ============ PATHS ============
ROOT_DIR = Path(__file__).parent.parent  # backend directory
