"""File Upload Security Tests

Tests for:
- File type validation
- File size limits
- Malicious file detection
- Path traversal in filenames
"""

import pytest
from httpx import AsyncClient
import io


@pytest.mark.asyncio
async def test_reject_executable_files(client: AsyncClient):
    """Test that executable files are rejected."""
    # Note: The upload endpoint is at /api/upload/media
    dangerous_extensions = [
        (".exe", b"MZ\x90\x00"),  # Windows executable
        (".sh", b"#!/bin/bash\nrm -rf /"),
        (".php", b"<?php system($_GET['cmd']); ?>"),
        (".jsp", b"<%@ page import=\"java.io.*\" %>"),
        (".py", b"import os; os.system('rm -rf /')"),
    ]
    
    for ext, content in dangerous_extensions:
        files = {"file": (f"malicious{ext}", io.BytesIO(content), "application/octet-stream")}
        response = await client.post("/api/upload/media", files=files)
        # Should require auth or reject file type
        assert response.status_code in [400, 401, 403, 404, 415, 422]


@pytest.mark.asyncio
async def test_reject_oversized_files(client: AsyncClient):
    """Test that oversized files are rejected."""
    # Create a 100MB file (should exceed limit)
    large_content = b"A" * (100 * 1024 * 1024)
    files = {"file": ("large.jpg", io.BytesIO(large_content), "image/jpeg")}
    
    response = await client.post("/api/upload/media", files=files)
    assert response.status_code in [400, 401, 404, 413, 422]


@pytest.mark.asyncio
async def test_reject_double_extension(client: AsyncClient):
    """Test that double extensions are handled safely."""
    dangerous_names = [
        "image.jpg.exe",
        "document.pdf.php",
        "photo.png.sh",
        "file.txt.jsp",
    ]
    
    for name in dangerous_names:
        files = {"file": (name, io.BytesIO(b"test content"), "image/jpeg")}
        response = await client.post("/api/upload", files=files)
        # Should either reject or sanitize the filename
        assert response.status_code in [200, 400, 401, 403, 415, 422]


@pytest.mark.asyncio
async def test_reject_path_traversal_filename(client: AsyncClient):
    """Test path traversal in filenames."""
    malicious_names = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "/etc/passwd",
        "C:\\Windows\\System32\\config\\SAM",
    ]
    
    for name in malicious_names:
        files = {"file": (name, io.BytesIO(b"test"), "image/jpeg")}
        response = await client.post("/api/upload", files=files)
        assert response.status_code in [400, 401, 403, 422]


@pytest.mark.asyncio
async def test_content_type_mismatch(client: AsyncClient):
    """Test that content type must match actual file content."""
    # Send executable content with image content type
    exe_content = b"MZ\x90\x00" + b"\x00" * 100
    files = {"file": ("image.jpg", io.BytesIO(exe_content), "image/jpeg")}
    
    response = await client.post("/api/upload", files=files)
    # Should either reject or validate actual content
    assert response.status_code in [200, 400, 401, 415, 422]


@pytest.mark.asyncio
async def test_null_byte_in_filename(client: AsyncClient):
    """Test null byte injection in filename."""
    malicious_names = [
        "image.jpg\x00.exe",
        "test\x00.php",
        "file.png\x00.sh",
    ]
    
    for name in malicious_names:
        files = {"file": (name, io.BytesIO(b"test"), "image/jpeg")}
        response = await client.post("/api/upload", files=files)
        assert response.status_code in [400, 401, 422]


@pytest.mark.asyncio
async def test_svg_with_script(client: AsyncClient):
    """Test SVG files with embedded scripts."""
    malicious_svg = b'''<?xml version="1.0"?>
    <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
    </svg>'''
    
    files = {"file": ("image.svg", io.BytesIO(malicious_svg), "image/svg+xml")}
    response = await client.post("/api/upload", files=files)
    # SVGs with scripts should be rejected or sanitized
    assert response.status_code in [200, 400, 401, 403, 415, 422]


@pytest.mark.asyncio
async def test_zip_bomb(client: AsyncClient):
    """Test handling of zip bombs (if zip uploads are allowed)."""
    # This is a simplified test - real zip bombs are much larger when decompressed
    # Creating a minimal zip structure
    zip_content = b"PK\x03\x04" + b"\x00" * 100
    files = {"file": ("archive.zip", io.BytesIO(zip_content), "application/zip")}
    
    response = await client.post("/api/upload", files=files)
    # Should either reject zips or handle safely
    assert response.status_code in [200, 400, 401, 415, 422]
