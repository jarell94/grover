import paypalrestsdk
import os
from dotenv import load_dotenv

load_dotenv()

# Configure PayPal SDK
paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),  # sandbox or live
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET")
})

def create_payment(amount, currency="USD", description="Product Purchase"):
    """Create a PayPal payment"""
    payment = paypalrestsdk.Payment({
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:3000/payment/success",
            "cancel_url": "http://localhost:3000/payment/cancel"
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
        print(f"Payment created successfully: {payment.id}")
        # Get approval URL
        for link in payment.links:
            if link.rel == "approval_url":
                return {
                    "success": True,
                    "payment_id": payment.id,
                    "approval_url": link.href
                }
    else:
        print(f"Payment creation failed: {payment.error}")
        return {
            "success": False,
            "error": payment.error
        }

def execute_payment(payment_id, payer_id):
    """Execute an approved PayPal payment"""
    payment = paypalrestsdk.Payment.find(payment_id)
    
    if payment.execute({"payer_id": payer_id}):
        print(f"Payment {payment_id} executed successfully")
        return {
            "success": True,
            "payment_id": payment.id,
            "state": payment.state
        }
    else:
        print(f"Payment execution failed: {payment.error}")
        return {
            "success": False,
            "error": payment.error
        }

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
