import sys

from media_service import apply_cdn_url, get_optimized_url, is_cloudinary_url


def test_apply_cdn_url_swaps_origin(monkeypatch):
    media_module = sys.modules["media_service"]
    monkeypatch.setattr(media_module, "ASSET_CDN_URL", "https://cdn.example.com/assets")

    original = "https://storage.example.com/uploads/image.jpg?size=large"
    expected = "https://cdn.example.com/assets/uploads/image.jpg?size=large"

    assert apply_cdn_url(original) == expected


def test_get_optimized_url_supports_custom_domain(monkeypatch):
    media_module = sys.modules["media_service"]
    monkeypatch.setattr(media_module, "ASSET_CDN_URL", "")
    monkeypatch.setattr(media_module, "CLOUDINARY_CONFIGURED", True)

    url = "https://cdn.images.example.com/image/upload/v1/sample.jpg"
    assert is_cloudinary_url(url, "image")
    optimized = get_optimized_url(url, width=400)

    assert "/image/upload/f_auto,q_auto,w_400/" in optimized
