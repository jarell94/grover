from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
import httpx
import base64
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from io import BytesIO
from PIL import Image
from paypal_service import create_payment, execute_payment, get_payment_details
from paypal_payout_service import send_payout

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Create FastAPI app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ MODELS ============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = ""
    is_premium: bool = False
    is_private: bool = False
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    paypal_email: Optional[str] = None
    created_at: datetime

class Post(BaseModel):
    post_id: str
    user_id: str
    content: str
    media_url: Optional[str] = None  # base64
    media_type: Optional[str] = None  # image/video/audio
    likes_count: int = 0
    dislikes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    tagged_users: List[str] = []  # List of user_ids
    location: Optional[str] = None
    created_at: datetime

class Comment(BaseModel):
    comment_id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For threaded replies
    likes_count: int = 0
    replies_count: int = 0
    tagged_users: List[str] = []  # List of user_ids mentioned
    created_at: datetime

class Product(BaseModel):
    product_id: str
    user_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None  # base64
    created_at: datetime

class Order(BaseModel):
    order_id: str
    buyer_id: str
    seller_id: str
    product_id: str
    amount: float
    status: str  # pending/completed/cancelled
    created_at: datetime

class Message(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    content: str
    read: bool = False
    created_at: datetime

class Notification(BaseModel):
    notification_id: str
    user_id: str
    type: str  # like/follow/purchase
    content: str
    read: bool = False
    created_at: datetime

# ============ AUTH HELPERS ============

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        session = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session:
            return None
        
        # Check expiry
        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return None
        
        user_doc = await db.users.find_one(
            {"user_id": session["user_id"]},
            {"_id": 0}
        )
        
        if user_doc:
            return User(**user_doc)
        return None
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return None

async def require_auth(current_user: Optional[User] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

# ============ AUTH ENDPOINTS ============

@api_router.get("/auth/session")
async def create_session(session_id: str):
    """Exchange session_id for user data and create session"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            user_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one(
                {"email": user_data["email"]},
                {"_id": 0}
            )
            
            if not existing_user:
                # Create new user
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await db.users.insert_one({
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data["picture"],
                    "bio": "",
                    "is_premium": False,
                    "is_private": False,
                    "created_at": datetime.now(timezone.utc)
                })
            else:
                user_id = existing_user["user_id"]
            
            # Create session
            session_token = user_data["session_token"]
            await db.user_sessions.insert_one({
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            })
            
            return {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data["picture"],
                "session_token": session_token
            }
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    return current_user

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(require_auth), authorization: str = Header(None)):
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}

# ============ USER ENDPOINTS ============

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(require_auth)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, current_user: User = Depends(require_auth)):
    posts_count = await db.posts.count_documents({"user_id": user_id})
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    return {
        "posts": posts_count,
        "followers": followers_count,
        "following": following_count
    }

@api_router.put("/users/me")
async def update_profile(
    name: Optional[str] = None, 
    bio: Optional[str] = None, 
    is_private: Optional[bool] = None,
    website: Optional[str] = None,
    twitter: Optional[str] = None,
    instagram: Optional[str] = None,
    linkedin: Optional[str] = None,
    paypal_email: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if bio is not None:
        update_data["bio"] = bio
    if is_private is not None:
        update_data["is_private"] = is_private
    if website is not None:
        update_data["website"] = website
    if twitter is not None:
        update_data["twitter"] = twitter
    if instagram is not None:
        update_data["instagram"] = instagram
    if linkedin is not None:
        update_data["linkedin"] = linkedin
    if paypal_email is not None:
        update_data["paypal_email"] = paypal_email
    
    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated"}

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: User = Depends(require_auth)):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    existing = await db.follows.find_one({
        "follower_id": current_user.user_id,
        "following_id": user_id
    })
    
    if existing:
        # Unfollow
        await db.follows.delete_one({
            "follower_id": current_user.user_id,
            "following_id": user_id
        })
        return {"message": "Unfollowed", "following": False}
    else:
        # Follow
        await db.follows.insert_one({
            "follower_id": current_user.user_id,
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Create notification
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "follow",
            "content": f"{current_user.name} started following you",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"message": "Followed", "following": True}

# ============ POST ENDPOINTS ============

@api_router.get("/posts")
async def get_posts(current_user: User = Depends(require_auth)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return posts

@api_router.get("/posts/feed")
async def get_feed(current_user: User = Depends(require_auth)):
    # Get followed users
    follows = await db.follows.find(
        {"follower_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    following_ids = [f["following_id"] for f in follows]
    following_ids.append(current_user.user_id)  # Include own posts
    
    posts = await db.posts.find(
        {"user_id": {"$in": following_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user data to each post
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # Check if current user liked
        liked = await db.likes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["liked"] = liked is not None
        
        # Check if current user disliked
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        
        # Check if current user saved
        saved = await db.saved_posts.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["saved"] = saved is not None
    
    return posts

@api_router.get("/posts/explore")
async def get_explore(current_user: User = Depends(require_auth)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add user data
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        liked = await db.likes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["liked"] = liked is not None
        
        # Check if current user disliked
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        
        # Check if current user saved
        saved = await db.saved_posts.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["saved"] = saved is not None
    
    return posts

@api_router.post("/posts")
async def create_post(
    content: str = Form(...),
    media: Optional[UploadFile] = File(None),
    tagged_users: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    current_user: User = Depends(require_auth)
):
    media_url = None
    media_type = None
    
    if media:
        # Read file and convert to base64
        file_content = await media.read()
        media_url = base64.b64encode(file_content).decode('utf-8')
        
        if media.content_type.startswith('image'):
            media_type = 'image'
        elif media.content_type.startswith('video'):
            media_type = 'video'
        elif media.content_type.startswith('audio'):
            media_type = 'audio'
    
    # Parse tagged users (comma-separated user_ids)
    tagged_user_list = []
    if tagged_users:
        tagged_user_list = [u.strip() for u in tagged_users.split(',') if u.strip()]
    
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    await db.posts.insert_one({
        "post_id": post_id,
        "user_id": current_user.user_id,
        "content": content,
        "media_url": media_url,
        "media_type": media_type,
        "likes_count": 0,
        "dislikes_count": 0,
        "shares_count": 0,
        "tagged_users": tagged_user_list,
        "location": location,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Create notifications for tagged users
    for tagged_user_id in tagged_user_list:
        if tagged_user_id != current_user.user_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": tagged_user_id,
                "type": "tag",
                "content": f"{current_user.name} tagged you in a post",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
    
    return {"post_id": post_id, "message": "Post created"}

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.likes.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # Unlike
        await db.likes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"message": "Unliked", "liked": False}
    else:
        # Like (remove dislike if exists)
        await db.dislikes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        
        await db.likes.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc)
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Create notification
        if post["user_id"] != current_user.user_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": post["user_id"],
                "type": "like",
                "content": f"{current_user.name} liked your post",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
        
        return {"message": "Liked", "liked": True}

@api_router.post("/posts/{post_id}/dislike")
async def dislike_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.dislikes.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # Remove dislike
        await db.dislikes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"dislikes_count": -1}}
        )
        return {"message": "Dislike removed", "disliked": False}
    else:
        # Dislike (remove like if exists)
        await db.likes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        
        await db.dislikes.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc)
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"dislikes_count": 1}}
        )
        
        return {"message": "Disliked", "disliked": True}

@api_router.post("/posts/{post_id}/save")
async def save_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.saved_posts.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # Unsave
        await db.saved_posts.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        return {"message": "Post unsaved", "saved": False}
    else:
        # Save
        await db.saved_posts.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc)
        })
        return {"message": "Post saved", "saved": True}

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment share count
    await db.posts.update_one(
        {"post_id": post_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Create notification
    if post["user_id"] != current_user.user_id:
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": post["user_id"],
            "type": "share",
            "content": f"{current_user.name} shared your post",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    return {"message": "Post shared", "shares_count": post.get("shares_count", 0) + 1}

@api_router.get("/posts/saved")
async def get_saved_posts(current_user: User = Depends(require_auth)):
    saved = await db.saved_posts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    post_ids = [s["post_id"] for s in saved]
    posts = await db.posts.find(
        {"post_id": {"$in": post_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Add user data and liked status
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        liked = await db.likes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["liked"] = liked is not None
        
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        post["saved"] = True
    
    return posts

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.posts.delete_one({"post_id": post_id})
    await db.likes.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

# ============ PRODUCT ENDPOINTS ============

@api_router.get("/products")
async def get_products(current_user: User = Depends(require_auth)):
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for product in products:
        user = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
        product["user"] = user
    
    return products

@api_router.get("/products/my-products")
async def get_my_products(current_user: User = Depends(require_auth)):
    products = await db.products.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return products

@api_router.post("/products")
async def create_product(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_auth)
):
    image_url = None
    if image:
        file_content = await image.read()
        image_url = base64.b64encode(file_content).decode('utf-8')
    
    product_id = f"prod_{uuid.uuid4().hex[:12]}"
    await db.products.insert_one({
        "product_id": product_id,
        "user_id": current_user.user_id,
        "name": name,
        "description": description,
        "price": price,
        "image_url": image_url,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"product_id": product_id, "message": "Product created"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(require_auth)):
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.products.delete_one({"product_id": product_id})
    return {"message": "Product deleted"}

# ============ ORDER ENDPOINTS ============

@api_router.post("/paypal/create-payment")
async def create_paypal_payment(
    product_id: str,
    current_user: User = Depends(require_auth)
):
    """Create a PayPal payment for a product"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create PayPal payment
    result = create_payment(
        amount=product["price"],
        currency="USD",
        description=f"Purchase: {product['name']}"
    )
    
    if result["success"]:
        return {
            "success": True,
            "payment_id": result["payment_id"],
            "approval_url": result["approval_url"]
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment creation failed"))

@api_router.post("/paypal/execute-payment")
async def execute_paypal_payment(
    payment_id: str,
    payer_id: str,
    product_id: str,
    current_user: User = Depends(require_auth)
):
    """Execute a PayPal payment after user approval"""
    result = execute_payment(payment_id, payer_id)
    
    if result["success"]:
        # Get product details
        product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get seller info
        seller = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
        
        # Calculate platform fee (5% for now, can be adjusted)
        platform_fee_percentage = 0.05
        platform_fee = product["price"] * platform_fee_percentage
        seller_amount = product["price"] - platform_fee
        
        # Create order in database
        order_id = f"order_{uuid.uuid4().hex[:12]}"
        await db.orders.insert_one({
            "order_id": order_id,
            "buyer_id": current_user.user_id,
            "seller_id": product["user_id"],
            "product_id": product_id,
            "amount": product["price"],
            "platform_fee": platform_fee,
            "seller_amount": seller_amount,
            "status": "completed",
            "paypal_payment_id": payment_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Send payout to seller if they have PayPal configured
        payout_info = None
        if seller and seller.get("paypal_email"):
            payout_result = send_payout(
                recipient_email=seller["paypal_email"],
                amount=seller_amount,
                note=f"Sale of '{product['name']}' on Grover"
            )
            
            if payout_result["success"]:
                # Update order with payout info
                await db.orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "payout_batch_id": payout_result.get("payout_batch_id"),
                        "payout_status": "sent"
                    }}
                )
                payout_info = "Payout sent to seller's PayPal"
            else:
                logger.error(f"Payout failed for order {order_id}: {payout_result.get('error')}")
                await db.orders.update_one(
                    {"order_id": order_id},
                    {"$set": {"payout_status": "failed", "payout_error": payout_result.get("error")}}
                )
                payout_info = "Payment received, but seller payout pending"
        else:
            # Seller doesn't have PayPal configured
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"payout_status": "pending_seller_setup"}}
            )
            payout_info = "Seller needs to configure PayPal to receive funds"
        
        # Create notification
        await db.notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": product["user_id"],
            "type": "purchase",
            "content": f"{current_user.name} purchased {product['name']}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "order_id": order_id,
            "message": "Payment completed successfully",
            "payout_info": payout_info,
            "seller_amount": seller_amount,
            "platform_fee": platform_fee
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment execution failed"))

@api_router.post("/orders")
async def create_order(
    product_id: str,
    paypal_order_id: str,
    current_user: User = Depends(require_auth)
):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    await db.orders.insert_one({
        "order_id": order_id,
        "buyer_id": current_user.user_id,
        "seller_id": product["user_id"],
        "product_id": product_id,
        "amount": product["price"],
        "status": "completed",
        "paypal_order_id": paypal_order_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": product["user_id"],
        "type": "purchase",
        "content": f"{current_user.name} purchased {product['name']}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"order_id": order_id, "message": "Order created"}

@api_router.get("/orders/my-orders")
async def get_my_orders(current_user: User = Depends(require_auth)):
    orders = await db.orders.find(
        {"buyer_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        product = await db.products.find_one({"product_id": order["product_id"]}, {"_id": 0})
        order["product"] = product
    
    return orders

# ============ MESSAGE ENDPOINTS ============

@api_router.get("/messages/conversations")
async def get_conversations(current_user: User = Depends(require_auth)):
    conversations = await db.conversations.find(
        {"participants": current_user.user_id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    for conv in conversations:
        # Get other user
        other_user_id = [p for p in conv["participants"] if p != current_user.user_id][0]
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
        conv["other_user"] = other_user
        
        # Get unread count
        unread_count = await db.messages.count_documents({
            "conversation_id": conv["conversation_id"],
            "sender_id": {"$ne": current_user.user_id},
            "read": False
        })
        conv["unread_count"] = unread_count
    
    return conversations

@api_router.get("/messages/{user_id}")
async def get_messages(user_id: str, current_user: User = Depends(require_auth)):
    # Find or create conversation
    conv = await db.conversations.find_one({
        "participants": {"$all": [current_user.user_id, user_id]}
    }, {"_id": 0})
    
    if not conv:
        conv_id = f"conv_{uuid.uuid4().hex[:12]}"
        await db.conversations.insert_one({
            "conversation_id": conv_id,
            "participants": [current_user.user_id, user_id],
            "last_message": "",
            "last_message_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        })
        return {"conversation_id": conv_id, "messages": []}
    
    messages = await db.messages.find(
        {"conversation_id": conv["conversation_id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Mark as read
    await db.messages.update_many(
        {
            "conversation_id": conv["conversation_id"],
            "sender_id": user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"conversation_id": conv["conversation_id"], "messages": messages}

# ============ ANALYTICS ENDPOINTS ============

@api_router.get("/analytics/revenue")
async def get_revenue_analytics(current_user: User = Depends(require_auth)):
    orders = await db.orders.find(
        {"seller_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(o["amount"] for o in orders)
    total_orders = len(orders)
    
    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders
    }

@api_router.get("/analytics/engagement")
async def get_engagement_analytics(current_user: User = Depends(require_auth)):
    posts_count = await db.posts.count_documents({"user_id": current_user.user_id})
    
    posts = await db.posts.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    total_likes = sum(p["likes_count"] for p in posts)
    
    followers_count = await db.follows.count_documents({"following_id": current_user.user_id})
    
    return {
        "total_posts": posts_count,
        "total_likes": total_likes,
        "total_followers": followers_count
    }

# ============ NOTIFICATION ENDPOINTS ============

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(require_auth)):
    notifications = await db.notifications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: User = Depends(require_auth)):
    await db.notifications.update_many(
        {"user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}

# ============ PREMIUM ENDPOINTS ============

@api_router.post("/premium/subscribe")
async def subscribe_premium(current_user: User = Depends(require_auth)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"is_premium": True}}
    )
    return {"message": "Premium subscription activated"}

@api_router.post("/premium/cancel")
async def cancel_premium(current_user: User = Depends(require_auth)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"is_premium": False}}
    )
    return {"message": "Premium subscription cancelled"}

# ============ SEARCH ENDPOINT ============

@api_router.get("/search")
async def search(q: str, current_user: User = Depends(require_auth)):
    users = await db.users.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).to_list(50)
    
    posts = await db.posts.find(
        {"content": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).to_list(50)
    
    return {"users": users, "posts": posts}

# ============ SOCKET.IO HANDLERS ============

active_users = {}

@sio.event
async def connect(sid, environ):
    logger.info(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    logger.info(f"Client {sid} disconnected")
    for user_id in list(active_users.keys()):
        if active_users[user_id] == sid:
            del active_users[user_id]
            break

@sio.event
async def join_conversation(sid, data):
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    
    if conversation_id and user_id:
        sio.enter_room(sid, f"conversation_{conversation_id}")
        active_users[user_id] = sid
        logger.info(f"User {user_id} joined conversation {conversation_id}")

@sio.event
async def send_message(sid, data):
    conversation_id = data.get("conversation_id")
    sender_id = data.get("sender_id")
    content = data.get("content")
    
    if not all([conversation_id, sender_id, content]):
        return
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    await db.messages.insert_one({
        "message_id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "content": content,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update conversation
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {
            "last_message": content,
            "last_message_at": datetime.now(timezone.utc)
        }}
    )
    
    # Get sender info
    sender = await db.users.find_one({"user_id": sender_id}, {"_id": 0})
    
    # Broadcast to room
    message_data = {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_name": sender["name"] if sender else "Unknown",
        "sender_picture": sender["picture"] if sender else None,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await sio.emit('new_message', message_data, room=f"conversation_{conversation_id}")

@sio.event
async def typing(sid, data):
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    
    if conversation_id and user_id:
        await sio.emit('user_typing', {"user_id": user_id}, room=f"conversation_{conversation_id}", skip_sid=sid)

# Health check at root
@app.get("/health")
async def health():
    return {"status": "ok"}

# Include router
app.include_router(api_router)

# Wrap with Socket.IO
app_with_socketio = socketio.ASGIApp(sio, app)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app_with_socketio, host="0.0.0.0", port=8001)
