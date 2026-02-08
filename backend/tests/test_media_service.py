import media_service


def test_apply_cdn_url_swaps_origin(monkeypatch):
    monkeypatch.setattr(media_service, "ASSET_CDN_URL", "https://cdn.example.com/assets")

    original = "https://storage.example.com/uploads/image.jpg?size=large"
    expected = "https://cdn.example.com/assets/uploads/image.jpg?size=large"

    assert media_service.apply_cdn_url(original) == expected


def test_get_optimized_url_supports_custom_domain(monkeypatch):
    monkeypatch.setattr(media_service, "ASSET_CDN_URL", "")

    url = "https://cdn.images.example.com/image/upload/v1/sample.jpg"
    optimized = media_service.get_optimized_url(url, width=400)

    assert "/image/upload/f_auto,q_auto,w_400/" in optimized
