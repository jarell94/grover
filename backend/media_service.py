"""
Media Upload Service - Optimized with Cloudinary & S3 Support

Features:
- Cloudinary: Primary storage with automatic optimization
- AWS S3: Secondary storage option
- Base64: Fallback when no cloud storage is configured
- Thumbnail generation: Fast PIL-based thumbnails
- Video compression: Cloudinary eager transformations
- Caching: LRU cache for optimized URLs

Setup:
1. Cloudinary (preferred for media-heavy apps):
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

2. AWS S3 (alternative):
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_S3_BUCKET=your_bucket_name
   AWS_S3_REGION=us-east-1
"""

import os
import base64
import uuid
import hashlib
from io import BytesIO
from typing import Optional, Dict, Any
from functools import lru_cache
from urllib.parse import urlparse, urlunparse
from PIL import Image
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for async operations
_executor = ThreadPoolExecutor(max_workers=4)

# ============ CLOUDINARY SETUP ============
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False
    logger.warning("Cloudinary not installed. Run: pip install cloudinary")

CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')

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

# ============ AWS S3 SETUP ============
try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False
    logger.warning("boto3 not installed. Run: pip install boto3")

AWS_ACCESS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_S3_BUCKET = os.environ.get('AWS_S3_BUCKET', '')
AWS_S3_REGION = os.environ.get('AWS_S3_REGION', 'us-east-1')
ASSET_CDN_URL = os.environ.get('ASSET_CDN_URL', '').rstrip('/')

S3_CONFIGURED = bool(
    S3_AVAILABLE and 
    AWS_ACCESS_KEY and 
    AWS_SECRET_KEY and 
    AWS_S3_BUCKET
)

_s3_client = None
if S3_CONFIGURED:
    try:
        _s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
            region_name=AWS_S3_REGION
        )
        logger.info(f"AWS S3 configured: bucket={AWS_S3_BUCKET}")
    except Exception as e:
        logger.error(f"S3 configuration failed: {e}")
        S3_CONFIGURED = False

# ============ THUMBNAIL SETTINGS ============
THUMBNAIL_SIZES = {
    'small': (100, 100),
    'medium': (200, 200),
    'large': (400, 400),
}
THUMBNAIL_QUALITY = 70

# ============ VIDEO COMPRESSION SETTINGS ============
VIDEO_TRANSFORMATIONS = {
    'thumbnail': {'start_offset': 0, 'format': 'jpg', 'quality': 'auto:low', 'width': 400, 'height': 400, 'crop': 'fill'},
    'preview': {'format': 'mp4', 'video_codec': 'h264', 'quality': 'auto:low', 'width': 480},
    'standard': {'format': 'mp4', 'video_codec': 'h264', 'quality': 'auto:good', 'width': 720},
    'hd': {'format': 'mp4', 'video_codec': 'h264', 'quality': 'auto:best', 'width': 1080},
}

# ============ HELPER FUNCTIONS ============

def apply_cdn_url(url: str) -> str:
    """
    Rewrite asset URL to use the CDN base when configured.

    Args:
        url: Original asset URL.
    Returns:
        CDN-rewritten URL if ASSET_CDN_URL is set; otherwise the original URL.
        The CDN rewrite replaces scheme/host and can prepend a path prefix while
        preserving the original path, query, and fragment.
    """
    if not ASSET_CDN_URL or not url:
        return url
    if not (url.startswith("http://") or url.startswith("https://")):
        return url

    try:
        cdn = urlparse(ASSET_CDN_URL)
        if not cdn.scheme or not cdn.netloc:
            return url

        parsed = urlparse(url)
        cdn_path = cdn.path.rstrip("/")
        new_path = f"{cdn_path}{parsed.path}" if cdn_path else parsed.path

        return urlunparse((
            cdn.scheme,
            cdn.netloc,
            new_path,
            parsed.params,
            parsed.query,
            parsed.fragment,
        ))
    except Exception:
        return url

def is_cloudinary_url(url: str, media_type: str) -> bool:
    """
    Check if URL matches Cloudinary delivery patterns.

    Args:
        url: Asset URL to evaluate.
        media_type: "image" or "video".
    Returns:
        True when the URL is a Cloudinary delivery URL or matches Cloudinary
        path patterns while Cloudinary is configured.
        Returns False for unsupported media_type values.
    """
    if not url:
        return False

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        path = parsed.path or ""
    except Exception:
        hostname = ""
        path = ""

    if hostname.endswith("cloudinary.com"):
        return True
    if not CLOUDINARY_CONFIGURED:
        return False

    if media_type == "image":
        return "/image/upload/" in path or "/image/fetch/" in path
    if media_type == "video":
        return "/video/upload/" in path or "/video/fetch/" in path
    return False

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
    if media_type in ("video", "audio"):
        return "video"
    return "image"


def generate_file_hash(data: bytes) -> str:
    """Generate a short hash for file deduplication"""
    return hashlib.md5(data).hexdigest()[:12]


# ============ THUMBNAIL GENERATION (OPTIMIZED) ============

def generate_thumbnail_sync(
    image_data: bytes, 
    size: str = 'medium',
    output_format: str = 'JPEG'
) -> Optional[bytes]:
    """
    Generate optimized thumbnail - runs synchronously for thread pool
    
    Optimizations:
    - Uses LANCZOS for quality, BILINEAR for speed
    - Strips metadata
    - Progressive JPEG for faster perceived loading
    """
    try:
        img = Image.open(BytesIO(image_data))
        
        # Get target size
        target_size = THUMBNAIL_SIZES.get(size, THUMBNAIL_SIZES['medium'])
        
        # Convert color mode if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Calculate aspect-preserving resize
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        
        # Save to bytes with optimization
        buffer = BytesIO()
        img.save(
            buffer, 
            format=output_format, 
            quality=THUMBNAIL_QUALITY,
            optimize=True,
            progressive=True  # Progressive JPEG loads faster
        )
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return None


def generate_thumbnail_base64(image_data: bytes, size: str = 'medium') -> Optional[str]:
    """Generate base64 encoded thumbnail"""
    thumb_bytes = generate_thumbnail_sync(image_data, size)
    if thumb_bytes:
        return base64.b64encode(thumb_bytes).decode('utf-8')
    return None


async def generate_thumbnail_async(image_data: bytes, size: str = 'medium') -> Optional[str]:
    """Generate thumbnail asynchronously using thread pool"""
    import asyncio
    loop = asyncio.get_event_loop()
    thumb_bytes = await loop.run_in_executor(
        _executor, 
        generate_thumbnail_sync, 
        image_data, 
        size
    )
    if thumb_bytes:
        return base64.b64encode(thumb_bytes).decode('utf-8')
    return None


# ============ S3 UPLOAD ============

async def upload_to_s3(
    file_data: bytes,
    filename: str,
    content_type: str,
    folder: str = "grover"
) -> Optional[Dict[str, Any]]:
    """Upload file to AWS S3"""
    if not S3_CONFIGURED or not _s3_client:
        return None
    
    try:
        import asyncio
        
        # Generate unique key
        file_ext = filename.split('.')[-1] if '.' in filename else 'bin'
        file_hash = generate_file_hash(file_data)
        s3_key = f"{folder}/{file_hash}_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            _executor,
            lambda: _s3_client.put_object(
                Bucket=AWS_S3_BUCKET,
                Key=s3_key,
                Body=file_data,
                ContentType=content_type,
                CacheControl='max-age=31536000',  # 1 year cache
            )
        )
        
        # Generate URL
        url = f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_key}"
        
        logger.info(f"Uploaded to S3: {s3_key}")
        return {
            "url": url,
            "key": s3_key,
            "bucket": AWS_S3_BUCKET,
        }
        
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        return None


# ============ CLOUDINARY UPLOAD (OPTIMIZED) ============

async def upload_to_cloudinary(
    file_data: bytes,
    filename: str,
    content_type: str,
    media_type: str,
    folder: str = "grover"
) -> Optional[Dict[str, Any]]:
    """
    Upload to Cloudinary with optimized transformations
    
    For videos:
    - Creates thumbnail automatically
    - Generates compressed preview version
    - Uses eager_async for background processing
    
    For images:
    - Auto-format (WebP for supported browsers)
    - Auto-quality optimization
    - Creates responsive breakpoints
    """
    if not CLOUDINARY_CONFIGURED:
        return None
    
    try:
        import asyncio
        
        resource_type = get_resource_type(media_type)
        file_hash = generate_file_hash(file_data)
        public_id = f"{folder}/{file_hash}_{uuid.uuid4().hex[:8]}"
        
        # Build upload options
        upload_options = {
            "public_id": public_id,
            "resource_type": resource_type,
            "overwrite": True,
            "unique_filename": False,
        }
        
        # Add transformations based on media type
        if media_type == "video":
            # Video-specific optimizations
            upload_options["eager"] = [
                # Thumbnail
                {"start_offset": "0", "format": "jpg", "quality": "auto", "width": 400, "height": 400, "crop": "fill"},
                # Compressed preview (for mobile)
                {"format": "mp4", "video_codec": "h264", "quality": "auto:low", "width": 480},
                # Standard quality
                {"format": "mp4", "video_codec": "h264", "quality": "auto:good", "width": 720},
            ]
            upload_options["eager_async"] = True
            upload_options["eager_notification_url"] = None  # Disable notifications
            
        elif media_type == "image":
            # Image-specific optimizations
            upload_options["eager"] = [
                # Optimized versions
                {"width": 400, "crop": "limit", "quality": "auto:low", "format": "auto"},
                {"width": 800, "crop": "limit", "quality": "auto:good", "format": "auto"},
                {"width": 1200, "crop": "limit", "quality": "auto:best", "format": "auto"},
            ]
            upload_options["eager_async"] = True
            # Enable responsive breakpoints for automatic srcset
            upload_options["responsive_breakpoints"] = {
                "create_derived": True,
                "bytes_step": 20000,
                "min_width": 200,
                "max_width": 1200,
                "max_images": 4,
            }
        
        # Upload in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            lambda: cloudinary.uploader.upload(file_data, **upload_options)
        )
        
        logger.info(f"Uploaded to Cloudinary: {result.get('public_id')}")
        
        return {
            "url": result.get("secure_url", result.get("url", "")),
            "public_id": result.get("public_id"),
            "width": result.get("width"),
            "height": result.get("height"),
            "duration": result.get("duration"),
            "format": result.get("format"),
            "bytes": result.get("bytes"),
            "eager": result.get("eager", []),
        }
        
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        return None


# ============ MAIN UPLOAD FUNCTION ============

async def upload_media(
    file_data: bytes,
    filename: str,
    content_type: str,
    folder: str = "grover",
    generate_thumbnail: bool = True,
    prefer_s3: bool = False,  # Set True to prefer S3 over Cloudinary
) -> Dict[str, Any]:
    """
    Upload media with automatic provider selection
    
    Priority:
    1. Cloudinary (best for images/video with transformations)
    2. S3 (good for raw storage, cheaper for large files)
    3. Base64 (fallback, not recommended for production)
    
    Returns:
        {
            "url": str,              # URL to access the media
            "public_id": str,        # Provider-specific ID
            "media_type": str,       # "image", "video", or "audio"
            "thumbnail": str,        # Base64 thumbnail (images only)
            "thumbnail_url": str,    # URL to thumbnail (Cloudinary videos)
            "is_cloud": bool,        # True if stored in cloud
            "provider": str,         # "cloudinary", "s3", or "base64"
            "width": int,            # Width (images/videos)
            "height": int,           # Height (images/videos)
            "duration": float,       # Duration (video/audio)
            "format": str,           # File format
            "bytes": int,            # File size
            "optimized_urls": dict,  # URLs for different sizes/qualities
        }
    """
    media_type = get_media_type_from_content_type(content_type)
    
    result = {
        "url": "",
        "public_id": None,
        "media_type": media_type,
        "thumbnail": None,
        "thumbnail_url": None,
        "is_cloud": False,
        "provider": "base64",
        "width": None,
        "height": None,
        "duration": None,
        "format": None,
        "bytes": len(file_data),
        "optimized_urls": {},
    }
    
    # Generate thumbnail for images (async)
    if generate_thumbnail and media_type == "image":
        result["thumbnail"] = await generate_thumbnail_async(file_data, 'medium')
    
    # Try cloud upload
    cloud_result = None
    
    if prefer_s3 and S3_CONFIGURED:
        # Try S3 first
        cloud_result = await upload_to_s3(file_data, filename, content_type, folder)
        if cloud_result:
            result["url"] = cloud_result["url"]
            result["public_id"] = cloud_result["key"]
            result["is_cloud"] = True
            result["provider"] = "s3"
    
    if not cloud_result and CLOUDINARY_CONFIGURED:
        # Try Cloudinary
        cloud_result = await upload_to_cloudinary(
            file_data, filename, content_type, media_type, folder
        )
        if cloud_result:
            result["url"] = cloud_result["url"]
            result["public_id"] = cloud_result["public_id"]
            result["is_cloud"] = True
            result["provider"] = "cloudinary"
            result["width"] = cloud_result.get("width")
            result["height"] = cloud_result.get("height")
            result["duration"] = cloud_result.get("duration")
            result["format"] = cloud_result.get("format")
            result["bytes"] = cloud_result.get("bytes", len(file_data))
            
            # Extract optimized URLs from eager transformations
            eager = cloud_result.get("eager", [])
            if eager and media_type == "video":
                for i, transform in enumerate(eager):
                    if i == 0:
                        result["thumbnail_url"] = transform.get("secure_url")
                    elif i == 1:
                        result["optimized_urls"]["preview"] = transform.get("secure_url")
                    elif i == 2:
                        result["optimized_urls"]["standard"] = transform.get("secure_url")
            elif eager and media_type == "image":
                for i, transform in enumerate(eager):
                    if i == 0:
                        result["optimized_urls"]["small"] = transform.get("secure_url")
                    elif i == 1:
                        result["optimized_urls"]["medium"] = transform.get("secure_url")
                    elif i == 2:
                        result["optimized_urls"]["large"] = transform.get("secure_url")
    
    if not cloud_result and S3_CONFIGURED and not prefer_s3:
        # Try S3 as fallback
        cloud_result = await upload_to_s3(file_data, filename, content_type, folder)
        if cloud_result:
            result["url"] = cloud_result["url"]
            result["public_id"] = cloud_result["key"]
            result["is_cloud"] = True
            result["provider"] = "s3"
    
    # Base64 fallback
    if not cloud_result:
        logger.warning(f"Using base64 fallback for {media_type} ({len(file_data)} bytes)")
        
        # Get image dimensions
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

    if result["url"]:
        result["url"] = apply_cdn_url(result["url"])
    if result.get("thumbnail_url"):
        result["thumbnail_url"] = apply_cdn_url(result["thumbnail_url"])
    if result.get("optimized_urls"):
        result["optimized_urls"] = {
            key: apply_cdn_url(value) for key, value in result["optimized_urls"].items()
        }

    return result


# ============ UTILITY FUNCTIONS ============

async def delete_media(public_id: str, resource_type: str = "image", provider: str = "cloudinary") -> bool:
    """Delete media from cloud storage"""
    if provider == "cloudinary" and CLOUDINARY_CONFIGURED:
        try:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            logger.info(f"Deleted from Cloudinary: {public_id}")
            return True
        except Exception as e:
            logger.error(f"Cloudinary delete failed: {e}")
            return False
    
    elif provider == "s3" and S3_CONFIGURED:
        try:
            _s3_client.delete_object(Bucket=AWS_S3_BUCKET, Key=public_id)
            logger.info(f"Deleted from S3: {public_id}")
            return True
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")
            return False
    
    return False


@lru_cache(maxsize=1000)
def get_optimized_url(
    url: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quality: str = "auto",
    format: str = "auto"
) -> str:
    """
    Get optimized/transformed URL (Cloudinary only)
    
    Uses LRU cache for performance
    """
    if not url or not is_cloudinary_url(url, "image"):
        return apply_cdn_url(url)
    
    try:
        transforms = []
        if width:
            transforms.append(f"w_{width}")
        if height:
            transforms.append(f"h_{height}")
        if width or height:
            transforms.append("c_limit")
        transforms.append(f"q_{quality}")
        transforms.append(f"f_{format}")
        
        transform_str = ",".join(transforms)
        
        for path in ("/image/upload/", "/image/fetch/"):
            if path in url:
                prefix, _, suffix = url.partition(path)
                return apply_cdn_url(f"{prefix}{path}{transform_str}/{suffix}")

        return apply_cdn_url(url)
    except:
        return apply_cdn_url(url)


def get_video_thumbnail_url(url: str, time_offset: float = 0.0) -> str:
    """Get thumbnail image from Cloudinary video"""
    if not url or not is_cloudinary_url(url, "video"):
        return apply_cdn_url(url)
    
    try:
        offset = f"so_{time_offset}" if time_offset > 0 else "so_0"
        transforms = f"{offset},f_jpg,q_auto,w_400,h_400,c_fill"
        
        for path in ("/video/upload/", "/video/fetch/"):
            if path in url:
                prefix, _, suffix = url.partition(path)
                return apply_cdn_url(f"{prefix}{path}{transforms}/{suffix}")

        return apply_cdn_url(url)
    except:
        return apply_cdn_url(url)


def get_video_preview_url(url: str, quality: str = "low") -> str:
    """Get compressed video preview URL (Cloudinary only)"""
    if not url or not is_cloudinary_url(url, "video"):
        return apply_cdn_url(url)
    
    try:
        width = 480 if quality == "low" else 720
        transforms = f"f_mp4,vc_h264,q_auto:{quality},w_{width}"
        
        for path in ("/video/upload/", "/video/fetch/"):
            if path in url:
                prefix, _, suffix = url.partition(path)
                return apply_cdn_url(f"{prefix}{path}{transforms}/{suffix}")

        return apply_cdn_url(url)
    except:
        return apply_cdn_url(url)


# ============ STATUS ============

def get_media_service_status() -> Dict[str, Any]:
    """Get current media service configuration status"""
    return {
        "cloudinary_available": CLOUDINARY_AVAILABLE,
        "cloudinary_configured": CLOUDINARY_CONFIGURED,
        "s3_available": S3_AVAILABLE,
        "s3_configured": S3_CONFIGURED,
        "asset_cdn_configured": bool(ASSET_CDN_URL),
        "cloud_name": CLOUDINARY_CLOUD_NAME[:4] + "***" if CLOUDINARY_CLOUD_NAME else None,
        "s3_bucket": AWS_S3_BUCKET[:4] + "***" if AWS_S3_BUCKET else None,
        "storage_mode": "cloudinary" if CLOUDINARY_CONFIGURED else ("s3" if S3_CONFIGURED else "base64"),
        "primary_provider": "cloudinary" if CLOUDINARY_CONFIGURED else ("s3" if S3_CONFIGURED else "base64"),
    }
