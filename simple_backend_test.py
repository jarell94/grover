#!/usr/bin/env python3
"""
Simple Backend Test for Grover - Direct MongoDB approach
"""

import requests
import pymongo
import uuid
from datetime import datetime, timezone, timedelta

def test_backend():
    print("🚀 Starting Simple Backend Test")
    
    # Connect to MongoDB
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    # Create test user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    session_token = f"test_token_{uuid.uuid4().hex}"
    
    print(f"Creating test user: {user_id}")
    print(f"Session token: {session_token}")
    
    # Insert test user
    test_user = {
        "user_id": user_id,
        "email": f"testuser_{uuid.uuid4().hex[:8]}@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
        "bio": "Test user for backend testing",
        "is_premium": False,
        "is_private": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    db.users.insert_one(test_user)
    print("✅ User created in database")
    
    # Insert session
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc)
    }
    
    db.user_sessions.insert_one(session_doc)
    print("✅ Session created in database")
    
    # Test authentication
    headers = {"Authorization": f"Bearer {session_token}"}
    response = requests.get("http://localhost:8001/api/auth/me", headers=headers)
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ Authentication successful: {user_data['name']}")
        
        # Test post creation
        print("\n📝 Testing post creation...")
        post_data = {
            "content": "Test post for comments",
            "tagged_users": user_id,
            "location": "Test Location"
        }
        
        response = requests.post("http://localhost:8001/api/posts", data=post_data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            post_id = result.get("post_id")
            print(f"✅ Post created: {post_id}")
            
            # Test comment creation
            print("\n💬 Testing comment creation...")
            comment_params = {"content": "This is a test comment"}
            
            response = requests.post(f"http://localhost:8001/api/posts/{post_id}/comments", 
                                   params=comment_params, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                comment_id = result.get("comment_id")
                print(f"✅ Comment created: {comment_id}")
                
                # Test get comments
                response = requests.get(f"http://localhost:8001/api/posts/{post_id}/comments", headers=headers)
                if response.status_code == 200:
                    comments = response.json()
                    print(f"✅ Retrieved {len(comments)} comments")
                else:
                    print(f"❌ Get comments failed: {response.status_code}")
                    
                # Test comment like
                response = requests.post(f"http://localhost:8001/api/comments/{comment_id}/like", headers=headers)
                if response.status_code == 200:
                    print("✅ Comment like successful")
                else:
                    print(f"❌ Comment like failed: {response.status_code}")
                    
            else:
                print(f"❌ Comment creation failed: {response.status_code}")
                print(f"Response: {response.text}")
                
            # Test post interactions
            print("\n🔄 Testing post interactions...")
            
            # Test dislike
            response = requests.post(f"http://localhost:8001/api/posts/{post_id}/dislike", headers=headers)
            if response.status_code == 200:
                print("✅ Post dislike successful")
            else:
                print(f"❌ Post dislike failed: {response.status_code}")
                
            # Test save
            response = requests.post(f"http://localhost:8001/api/posts/{post_id}/save", headers=headers)
            if response.status_code == 200:
                print("✅ Post save successful")
            else:
                print(f"❌ Post save failed: {response.status_code}")
                
            # Test share
            response = requests.post(f"http://localhost:8001/api/posts/{post_id}/share", headers=headers)
            if response.status_code == 200:
                print("✅ Post share successful")
            else:
                print(f"❌ Post share failed: {response.status_code}")
                
            # Test get saved posts
            response = requests.get("http://localhost:8001/api/posts/saved", headers=headers)
            if response.status_code == 200:
                saved_posts = response.json()
                print(f"✅ Retrieved {len(saved_posts)} saved posts")
            else:
                print(f"❌ Get saved posts failed: {response.status_code}")
                
        else:
            print(f"❌ Post creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Cleanup
    db.users.delete_one({"user_id": user_id})
    db.user_sessions.delete_one({"session_token": session_token})
    client.close()
    
    print("\n🧹 Cleanup completed")

if __name__ == "__main__":
    test_backend()