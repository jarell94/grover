from types import SimpleNamespace

import paypal_payout_service


def test_send_payout_success(monkeypatch):
    class DummyPayout:
        def __init__(self, payload):
            self.payload = payload
            self.batch_header = SimpleNamespace(
                payout_batch_id="batch-123",
                batch_status="SUCCESS"
            )
            self.error = {"message": "nope"}

        def create(self):
            return True

    monkeypatch.setattr(paypal_payout_service, "Payout", DummyPayout)

    result = paypal_payout_service.send_payout("seller@example.com", 25.0)

    assert result["success"] is True
    assert result["payout_batch_id"] == "batch-123"
    assert result["batch_status"] == "SUCCESS"


def test_send_payout_failure(monkeypatch):
    class DummyPayout:
        def __init__(self, payload):
            self.error = {"message": "failed"}

        def create(self):
            return False

    monkeypatch.setattr(paypal_payout_service, "Payout", DummyPayout)

    result = paypal_payout_service.send_payout("seller@example.com", 30.0)

    assert result["success"] is False
    assert result["error"] == "{'message': 'failed'}"


def test_send_payout_exception(monkeypatch):
    def raise_error(_payload):
        raise RuntimeError("network down")

    monkeypatch.setattr(paypal_payout_service, "Payout", raise_error)

    result = paypal_payout_service.send_payout("seller@example.com", 18.0)

    assert result["success"] is False
    assert "network down" in result["error"]


def test_get_payout_status_success(monkeypatch):
    class DummyPayout:
        def __init__(self):
            self.batch_header = SimpleNamespace(
                batch_status="PENDING",
                payout_batch_id="batch-999"
            )

    monkeypatch.setattr(paypal_payout_service.Payout, "find", lambda _batch_id: DummyPayout())

    result = paypal_payout_service.get_payout_status("batch-999")

    assert result["success"] is True
    assert result["batch_status"] == "PENDING"
    assert result["payout_batch_id"] == "batch-999"


def test_get_payout_status_not_found(monkeypatch):
    def raise_missing(_batch_id):
        raise paypal_payout_service.ResourceNotFound("missing")

    monkeypatch.setattr(paypal_payout_service.Payout, "find", raise_missing)

    result = paypal_payout_service.get_payout_status("missing")

    assert result["success"] is False
    assert result["error"] == "Payout not found"


def test_get_payout_status_exception(monkeypatch):
    def raise_error(_batch_id):
        raise RuntimeError("timeout")

    monkeypatch.setattr(paypal_payout_service.Payout, "find", raise_error)

    result = paypal_payout_service.get_payout_status("batch-error")

    assert result["success"] is False
    assert result["error"] == "timeout"
