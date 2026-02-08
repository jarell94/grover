from types import SimpleNamespace

import paypal_service


def test_create_payment_success(monkeypatch):
    class DummyPayment:
        def __init__(self, payload):
            self.payload = payload
            self.links = [SimpleNamespace(rel="approval_url", href="https://paypal/approve")]
            self.id = "payment-123"

        def create(self):
            return True

        def to_dict(self):
            return {"id": self.id}

    monkeypatch.setattr(paypal_service.paypalrestsdk, "Payment", DummyPayment)

    result = paypal_service.create_payment(12.5, description="Test item")

    assert result["success"] is True
    assert result["payment_id"] == "payment-123"
    assert result["approval_url"] == "https://paypal/approve"


def test_create_payment_missing_approval_url(monkeypatch):
    class DummyPayment:
        def __init__(self, payload):
            self.links = [SimpleNamespace(rel="self", href="https://paypal/self")]
            self.id = "payment-456"

        def create(self):
            return True

        def to_dict(self):
            return {"id": self.id}

    monkeypatch.setattr(paypal_service.paypalrestsdk, "Payment", DummyPayment)

    result = paypal_service.create_payment(9.99)

    assert result["success"] is False
    assert result["error"] == "No approval_url returned"


def test_create_payment_failure(monkeypatch):
    class DummyPayment:
        def __init__(self, payload):
            self.error = {"message": "create failed"}

        def create(self):
            return False

    monkeypatch.setattr(paypal_service.paypalrestsdk, "Payment", DummyPayment)

    result = paypal_service.create_payment(4.0)

    assert result["success"] is False
    assert result["error"] == {"message": "create failed"}


def test_execute_payment_success(monkeypatch):
    class DummyPayment:
        def __init__(self):
            self.state = "approved"
            self.id = "payment-789"
            self.transactions = [
                SimpleNamespace(amount=SimpleNamespace(total="10.00", currency="USD"))
            ]

        def execute(self, payload):
            return True

        def to_dict(self):
            return {"id": self.id}

    monkeypatch.setattr(paypal_service.paypalrestsdk.Payment, "find", lambda _payment_id: DummyPayment())

    result = paypal_service.execute_payment("payment-789", "payer-1", expected_total="10.00")

    assert result["success"] is True
    assert result["payment_id"] == "payment-789"
    assert result["state"] == "approved"


def test_execute_payment_total_mismatch(monkeypatch):
    class DummyPayment:
        def __init__(self):
            self.state = "approved"
            self.id = "payment-101"
            self.transactions = [
                SimpleNamespace(amount=SimpleNamespace(total="8.00", currency="USD"))
            ]

        def execute(self, payload):
            return True

        def to_dict(self):
            return {"id": self.id}

    monkeypatch.setattr(paypal_service.paypalrestsdk.Payment, "find", lambda _payment_id: DummyPayment())

    result = paypal_service.execute_payment("payment-101", "payer-2", expected_total="10.00")

    assert result["success"] is False
    assert "Total mismatch" in result["error"]


def test_execute_payment_failure(monkeypatch):
    class DummyPayment:
        def __init__(self):
            self.error = {"message": "execute failed"}

        def execute(self, payload):
            return False

    monkeypatch.setattr(paypal_service.paypalrestsdk.Payment, "find", lambda _payment_id: DummyPayment())

    result = paypal_service.execute_payment("payment-202", "payer-3")

    assert result["success"] is False
    assert result["error"] == {"message": "execute failed"}


def test_get_payment_details_success(monkeypatch):
    class DummyPayment:
        def __init__(self):
            self.id = "payment-303"
            self.state = "approved"
            self.create_time = "now"
            self.update_time = "later"
            self.intent = "sale"

    monkeypatch.setattr(paypal_service.paypalrestsdk.Payment, "find", lambda _payment_id: DummyPayment())

    result = paypal_service.get_payment_details("payment-303")

    assert result["success"] is True
    assert result["payment"]["id"] == "payment-303"
    assert result["payment"]["state"] == "approved"


def test_get_payment_details_failure(monkeypatch):
    def raise_error(_payment_id):
        raise RuntimeError("boom")

    monkeypatch.setattr(paypal_service.paypalrestsdk.Payment, "find", raise_error)

    result = paypal_service.get_payment_details("payment-404")

    assert result["success"] is False
    assert "boom" in result["error"]
