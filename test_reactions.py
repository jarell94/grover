#!/usr/bin/env python3

import asyncio
import httpx
import json
from datetime import datetime, timezone
import uuid

async def test_reactions():
    """Test the new reactions system"""
    base_url = "http://localhost:8001/api"
    
    # Test data
    test_user = {
        "user_id": "test_user_123",
        "email": "test@example.com", 
        "name": "Test User",
        "session_token": "test_token_123"
    }
    
    # Create a test post first
    async with httpx.AsyncClient() as client:
        # Test the new react endpoint
        print("Testing new reactions system...")
        
        # Test reacting with 'like'
        print("\n1. Testing 'like' reaction:")
        response = await client.post(
            f"{base_url}/posts/test_post_123/react",
            params={"reaction_type": "like"},
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # Test reacting with 'love'
        print("\n2. Testing 'love' reaction:")
        response = await client.post(
            f"{base_url}/posts/test_post_123/react",
            params={"reaction_type": "love"},
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # Test getting reactions
        print("\n3. Testing get reactions:")
        response = await client.get(
            f"{base_url}/posts/test_post_123/reactions",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # Test legacy like endpoint
        print("\n4. Testing legacy like endpoint:")
        response = await client.post(
            f"{base_url}/posts/test_post_123/like",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_reactions())