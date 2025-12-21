"""
Media Upload Service - Cloudinary Integration

This service handles all media uploads to Cloudinary.
Supports images, videos, and audio files.

Setup:
1. Create a free Cloudinary account at https://cloudinary.com
2. Add these to your .env file:
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
"""

import os
import base64
import uuid
from io import BytesIO
from typing import Optional, Tuple, Dict, Any
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Try to import cloudinary
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False
    logger.warning("Cloudinary not installed. Media uploads will use base64 fallback.")

# Configuration
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')

# Check if Cloudinary is configured
CLOUDINARY_CONFIGURED = bool(
    CLOUDINARY_AVAILABLE and 
    CLOUDINARY_CLOUD_NAME and 
    CLOUDINARY_API_KEY and 
    CLOUDINARY_API_SECRET
)

if CLOUDINARY_CONFIGURED:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    logger.info("Cloudinary configured successfully")
else:
    logger.warning("Cloudinary not configured. Using base64 fallback for media storage.")


# Thumbnail settings
THUMBNAIL_MAX_SIZE = (200, 200)
THUMBNAIL_QUALITY = 60


def get_media_type_from_content_type(content_type: str) -> str:
    """Determine media type from content type header"""
    if not content_type:
        return "image"
    
    content_type = content_type.lower()
    if content_type.startswith("video/"):
        return "video"
    elif content_type.startswith("audio/"):
        return "audio"
    elif content_type.startswith("image/"):
        return "image"
    return "image"


def get_resource_type(media_type: str) -> str:
    """Map our media type to Cloudinary resource type"""
    if media_type == "video":
        return "video"
    elif media_type == "audio":
        return "video"  # Cloudinary treats audio as video resource type
    return "image"


def generate_thumbnail_base64(image_data: bytes) -> Optional[str]:
    """Generate a small base64 thumbnail for quick previews"""
    try:
        img = Image.open(BytesIO(image_data))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Create thumbnail
        img.thumbnail(THUMBNAIL_MAX_SIZE, Image.Resampling.LANCZOS)
        
        # Save to bytes
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=THUMBNAIL_QUALITY, optimize=True)
        buffer.seek(0)
        
        # Return base64
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return None


async def upload_media(
    file_data: bytes,
    filename: str,
    content_type: str,
    folder: str = "grover",
    generate_thumbnail: bool = True
) -> Dict[str, Any]:
    """
    Upload media to Cloudinary or fallback to base64
    
    Returns:
        {
            "url": str,              # Full URL to the media (or base64 data URI)
            "public_id": str,        # Cloudinary public ID (or None for base64)
            "media_type": str,       # "image", "video", or "audio"
            "thumbnail": str,        # Base64 thumbnail (for images only)
            "is_cloud": bool,        # True if stored in cloud, False if base64
            "width": int,            # Width (for images/videos)
            "height": int,           # Height (for images/videos)
            "duration": float,       # Duration in seconds (for video/audio)
            "format": str,           # File format
            "bytes": int,            # File size in bytes
        }
    """
    media_type = get_media_type_from_content_type(content_type)
    resource_type = get_resource_type(media_type)
    
    result = {
        "url": "",
        "public_id": None,
        "media_type": media_type,
        "thumbnail": None,
        "is_cloud": False,
        "width": None,
        "height": None,
        "duration": None,
        "format": None,
        "bytes": len(file_data),
    }
    
    # Generate thumbnail for images
    if generate_thumbnail and media_type == "image":
        result["thumbnail"] = generate_thumbnail_base64(file_data)
    
    # Try Cloudinary upload
    if CLOUDINARY_CONFIGURED:
        try:
            # Generate unique public ID
            public_id = f"{folder}/{uuid.uuid4().hex[:16]}"
            
            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(
                file_data,
                public_id=public_id,
                resource_type=resource_type,
                folder=folder,
                overwrite=True,
                # Transformations for optimization
                eager=[
                    # For images: create optimized versions
                    {"width": 1200, "crop": "limit", "quality": "auto:good"} if media_type == "image" else {},
                ],
                eager_async=True,
            )
            
            result["url"] = upload_result.get("secure_url", upload_result.get("url", ""))
            result["public_id"] = upload_result.get("public_id")
            result["is_cloud"] = True
            result["width"] = upload_result.get("width")
            result["height"] = upload_result.get("height")
            result["duration"] = upload_result.get("duration")
            result["format"] = upload_result.get("format")
            result["bytes"] = upload_result.get("bytes", len(file_data))
            
            logger.info(f"Uploaded {media_type} to Cloudinary: {result['public_id']}")
            return result
            
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            # Fall through to base64 fallback
    
    # Fallback: Base64 encoding
    logger.info(f"Using base64 fallback for {media_type}")
    
    # For images, get dimensions
    if media_type == "image":
        try:
            img = Image.open(BytesIO(file_data))
            result["width"] = img.width
            result["height"] = img.height
            result["format"] = img.format.lower() if img.format else "jpeg"
        except:
            pass
    
    # Create base64 data URI
    mime_type = content_type or "application/octet-stream"
    base64_data = base64.b64encode(file_data).decode('utf-8')
    result["url"] = f"data:{mime_type};base64,{base64_data}"
    
    return result


async def delete_media(public_id: str, resource_type: str = "image") -> bool:
    """Delete media from Cloudinary"""
    if not CLOUDINARY_CONFIGURED or not public_id:
        return False
    
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        logger.info(f"Deleted media from Cloudinary: {public_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete media: {e}")
        return False


def get_optimized_url(
    url: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quality: str = "auto",
    format: str = "auto"
) -> str:
    """
    Get an optimized/transformed URL for a Cloudinary image
    
    Only works for Cloudinary URLs. Returns original URL otherwise.
    """
    if not url or "cloudinary" not in url:
        return url
    
    try:
        # Build transformation string
        transforms = []
        if width:
            transforms.append(f"w_{width}")
        if height:
            transforms.append(f"h_{height}")
        transforms.append(f"q_{quality}")
        transforms.append(f"f_{format}")
        
        transform_str = ",".join(transforms)
        
        # Insert transformation into URL
        # Cloudinary URLs look like: https://res.cloudinary.com/cloud_name/image/upload/v123/public_id.ext
        parts = url.split("/upload/")
        if len(parts) == 2:
            return f"{parts[0]}/upload/{transform_str}/{parts[1]}"
        
        return url
    except:
        return url


def get_video_thumbnail_url(url: str, time: float = 0.0) -> str:
    """
    Get a thumbnail image from a Cloudinary video URL
    """
    if not url or "cloudinary" not in url:
        return url
    
    try:
        # Replace video resource type with image and add thumbnail transformation
        url = url.replace("/video/upload/", "/video/upload/so_0,f_jpg,q_auto/")
        return url
    except:
        return url


# Export configuration status
def get_media_service_status() -> Dict[str, Any]:
    """Get current media service configuration status"""
    return {
        "cloudinary_available": CLOUDINARY_AVAILABLE,
        "cloudinary_configured": CLOUDINARY_CONFIGURED,
        "cloud_name": CLOUDINARY_CLOUD_NAME[:4] + "***" if CLOUDINARY_CLOUD_NAME else None,
        "storage_mode": "cloudinary" if CLOUDINARY_CONFIGURED else "base64",
    }
