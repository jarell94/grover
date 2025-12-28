import paypalrestsdk
import os
from decimal import Decimal, ROUND_HALF_UP
from dotenv import load_dotenv

load_dotenv()

# Configure PayPal SDK
paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),  # sandbox or live
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET")
})

# PayPal redirect URLs - use environment variables for production
# Note: These should be set via deployment environment variables pointing to your production domain
RETURN_URL = os.getenv("PAYPAL_RETURN_URL")
CANCEL_URL = os.getenv("PAYPAL_CANCEL_URL")

# Only warn in development if PayPal credentials are present but URLs are missing
if os.getenv("PAYPAL_CLIENT_ID") and (not RETURN_URL or not CANCEL_URL):
    import warnings
    warnings.warn("PAYPAL_RETURN_URL and PAYPAL_CANCEL_URL should be set in environment variables for production")

def create_payment(amount, currency="USD", description="Product Purchase"):
    """Create a PayPal payment"""
    # Format amount to 2 decimal places for precise currency handling
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": RETURN_URL,
            "cancel_url": CANCEL_URL
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": description,
                    "sku": "item",
                    "price": str(amount),
                    "currency": currency,
                    "quantity": 1
                }]
            },
            "amount": {
                "total": str(amount),
                "currency": currency
            },
            "description": description
        }]
    })

    if payment.create():
        approval = next((l.href for l in payment.links if l.rel == "approval_url"), None)
        if not approval:
            return {"success": False, "error": "No approval_url returned", "raw": payment.to_dict()}
        return {"success": True, "payment_id": payment.id, "approval_url": approval}
    return {"success": False, "error": payment.error}

def execute_payment(payment_id, payer_id, expected_total=None, expected_currency="USD"):
    """Execute an approved PayPal payment with verification"""
    payment = paypalrestsdk.Payment.find(payment_id)

    if not payment.execute({"payer_id": payer_id}):
        return {"success": False, "error": payment.error}

    # Verify state
    if payment.state != "approved":
        return {"success": False, "error": f"Unexpected payment state: {payment.state}"}

    # Verify amount (if you pass expected_total)
    try:
        txn = payment.transactions[0]
        total = txn.amount.total
        currency = txn.amount.currency
        if expected_total is not None and str(expected_total) != str(total):
            return {"success": False, "error": f"Total mismatch expected={expected_total} got={total}"}
        if expected_currency and expected_currency != currency:
            return {"success": False, "error": f"Currency mismatch expected={expected_currency} got={currency}"}
    except Exception:
        pass

    return {"success": True, "payment_id": payment.id, "state": payment.state, "raw": payment.to_dict()}

def get_payment_details(payment_id):
    """Get details of a PayPal payment"""
    try:
        payment = paypalrestsdk.Payment.find(payment_id)
        return {
            "success": True,
            "payment": {
                "id": payment.id,
                "state": payment.state,
                "create_time": payment.create_time,
                "update_time": payment.update_time,
                "intent": payment.intent
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
