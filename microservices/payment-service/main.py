"""
Payment Service - Microservice for payment processing

Handles:
- PayPal payment creation and execution
- PayPal payouts
- Order management
- Transaction history
"""
from fastapi import FastAPI, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional
import sys
import os
from datetime import datetime
import uuid

# Add paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from shared.schemas import HealthCheckResponse
from shared.utils import ServiceConfig, setup_logging, make_service_request

# Import PayPal services
from paypal_service import (
    create_payment,
    execute_payment,
    get_payment_details
)
from paypal_payout_service import (
    send_payout,
    get_payout_status
)

# Configuration
config = ServiceConfig("payment")
logger = setup_logging("payment-service")

# Create FastAPI app
app = FastAPI(
    title="Payment Service",
    description="Microservice for payment processing",
    version=config.version
)

# Database connection
db_client = None
db = None


# ============ SCHEMAS ============

class PaymentCreate(BaseModel):
    """Schema for creating a payment."""
    amount: float
    currency: str = "USD"
    description: str
    user_id: str


class PaymentExecute(BaseModel):
    """Schema for executing a payment."""
    payment_id: str
    payer_id: str


class PayoutCreate(BaseModel):
    """Schema for creating a payout."""
    recipient_email: str
    amount: float
    currency: str = "USD"
    note: str
    user_id: str


# ============ DATABASE SETUP ============

async def get_database():
    """Get database instance."""
    global db
    if not db:
        raise RuntimeError("Database not connected")
    return db


# ============ HEALTH CHECK ============

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Service health check."""
    return HealthCheckResponse(
        status="healthy",
        service="payment-service",
        version=config.version,
        timestamp=datetime.now()
    )


@app.get("/health/db")
async def database_health():
    """Check database connection."""
    try:
        database = await get_database()
        await database.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# ============ PAYMENT ENDPOINTS ============

@app.post("/api/payments/create")
async def create_payment_endpoint(
    payment_data: PaymentCreate,
    database=Depends(get_database)
):
    """
    Create a PayPal payment.
    
    Returns approval URL for the user to complete payment.
    """
    try:
        # Create PayPal payment
        payment = create_payment(
            amount=payment_data.amount,
            currency=payment_data.currency,
            description=payment_data.description
        )
        
        if not payment.create():
            logger.error(f"Payment creation failed: {payment.error}")
            raise HTTPException(
                status_code=500,
                detail=f"Payment creation failed: {payment.error}"
            )
        
        # Store order in database
        order_id = str(uuid.uuid4())
        await database.orders.insert_one({
            "order_id": order_id,
            "payment_id": payment.id,
            "user_id": payment_data.user_id,
            "amount": payment_data.amount,
            "currency": payment_data.currency,
            "description": payment_data.description,
            "status": "pending",
            "created_at": datetime.now()
        })
        
        # Get approval URL
        approval_url = None
        for link in payment.links:
            if link.rel == "approval_url":
                approval_url = link.href
                break
        
        return {
            "status": "success",
            "payment_id": payment.id,
            "order_id": order_id,
            "approval_url": approval_url
        }
    
    except Exception as e:
        logger.error(f"Payment creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payments/execute")
async def execute_payment_endpoint(
    payment_exec: PaymentExecute,
    database=Depends(get_database)
):
    """
    Execute a PayPal payment after user approval.
    """
    try:
        # Execute payment
        payment = execute_payment(
            payment_exec.payment_id,
            payment_exec.payer_id
        )
        
        if not payment:
            raise HTTPException(status_code=400, detail="Payment execution failed")
        
        # Update order status
        await database.orders.update_one(
            {"payment_id": payment_exec.payment_id},
            {"$set": {
                "status": "completed",
                "payer_id": payment_exec.payer_id,
                "completed_at": datetime.now()
            }}
        )
        
        return {
            "status": "success",
            "payment_id": payment_exec.payment_id,
            "state": payment.state
        }
    
    except Exception as e:
        logger.error(f"Payment execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/payments/{payment_id}")
async def get_payment(payment_id: str):
    """Get payment details."""
    try:
        payment = get_payment_details(payment_id)
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return {
            "payment_id": payment.id,
            "state": payment.state,
            "amount": payment.transactions[0].amount.total if payment.transactions else None,
            "currency": payment.transactions[0].amount.currency if payment.transactions else None,
            "created": payment.create_time
        }
    
    except Exception as e:
        logger.error(f"Get payment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payments/payout")
async def create_payout_endpoint(
    payout_data: PayoutCreate,
    database=Depends(get_database)
):
    """
    Create a PayPal payout.
    """
    try:
        # Send payout
        result = send_payout(
            recipient_email=payout_data.recipient_email,
            amount=payout_data.amount,
            currency=payout_data.currency,
            note=payout_data.note
        )
        
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Store payout in database
        payout_id = str(uuid.uuid4())
        await database.payouts.insert_one({
            "payout_id": payout_id,
            "batch_id": result.get("batch_id"),
            "user_id": payout_data.user_id,
            "recipient_email": payout_data.recipient_email,
            "amount": payout_data.amount,
            "currency": payout_data.currency,
            "note": payout_data.note,
            "status": result.get("status", "pending"),
            "created_at": datetime.now()
        })
        
        return {
            "status": "success",
            "payout_id": payout_id,
            "batch_id": result.get("batch_id")
        }
    
    except Exception as e:
        logger.error(f"Payout creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/payments/payout/{batch_id}/status")
async def payout_status(batch_id: str):
    """Get payout status."""
    try:
        status = get_payout_status(batch_id)
        return status
    
    except Exception as e:
        logger.error(f"Get payout status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ ROOT ENDPOINT ============

@app.get("/")
async def root():
    """Service root endpoint."""
    return {
        "service": "Payment Service",
        "version": config.version,
        "status": "running",
        "endpoints": {
            "create_payment": "POST /api/payments/create",
            "execute_payment": "POST /api/payments/execute",
            "get_payment": "GET /api/payments/{payment_id}",
            "create_payout": "POST /api/payments/payout",
            "payout_status": "GET /api/payments/payout/{batch_id}/status"
        }
    }


# ============ LIFECYCLE EVENTS ============

@app.on_event("startup")
async def startup():
    """Initialize service on startup."""
    global db_client, db
    
    logger.info(f"Starting Payment Service v{config.version}")
    logger.info(f"Environment: {config.environment}")
    
    # Connect to database
    try:
        db_client = AsyncIOMotorClient(config.mongo_url)
        db = db_client[config.db_name]
        logger.info(f"Connected to MongoDB: {config.db_name}")
        
        # Create indexes
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("payment_id")
        await db.orders.create_index("user_id")
        await db.payouts.create_index("payout_id", unique=True)
        await db.payouts.create_index("batch_id")
        
        logger.info("Database indexes created")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    global db_client
    
    logger.info("Shutting down Payment Service")
    
    if db_client:
        db_client.close()
        logger.info("Database connection closed")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.port)
