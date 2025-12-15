import paypalrestsdk
from paypalrestsdk import Payout, ResourceNotFound
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

# Configure PayPal SDK
paypalrestsdk.configure({
    "mode": os.getenv("PAYPAL_MODE", "sandbox"),
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET")
})

def send_payout(recipient_email, amount, note="Payment from Grover"):
    """
    Send a payout to a seller's PayPal account
    
    Args:
        recipient_email: Seller's PayPal email
        amount: Amount to send (USD)
        note: Description of the payout
    
    Returns:
        dict with success status and payout details
    """
    try:
        sender_batch_id = f"payout_{uuid.uuid4().hex[:12]}"
        
        payout = Payout({
            "sender_batch_header": {
                "sender_batch_id": sender_batch_id,
                "email_subject": "You have a payment from Grover!",
                "email_message": "You have received a payment for your product sale on Grover."
            },
            "items": [
                {
                    "recipient_type": "EMAIL",
                    "amount": {
                        "value": str(amount),
                        "currency": "USD"
                    },
                    "receiver": recipient_email,
                    "note": note,
                    "sender_item_id": f"item_{uuid.uuid4().hex[:8]}"
                }
            ]
        })
        
        if payout.create():
            print(f"Payout created successfully: {payout.batch_header.payout_batch_id}")
            return {
                "success": True,
                "payout_batch_id": payout.batch_header.payout_batch_id,
                "batch_status": payout.batch_header.batch_status
            }
        else:
            print(f"Payout creation failed: {payout.error}")
            return {
                "success": False,
                "error": str(payout.error)
            }
    except Exception as e:
        print(f"Payout exception: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def get_payout_status(payout_batch_id):
    """Get the status of a payout batch"""
    try:
        payout = Payout.find(payout_batch_id)
        return {
            "success": True,
            "batch_status": payout.batch_header.batch_status,
            "payout_batch_id": payout.batch_header.payout_batch_id
        }
    except ResourceNotFound:
        return {
            "success": False,
            "error": "Payout not found"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
