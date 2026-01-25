#!/usr/bin/env python3

import asyncio
import httpx
import json

async def test_collections():
    """Test the new collections system"""
    base_url = "http://192.168.1.101:8001/api"
    
    # Test data
    test_user = {
        "user_id": "test_user_123",
        "session_token": "test_token_123"
    }
    
    async with httpx.AsyncClient() as client:
        print("Testing Collections System...")
        
        # 1. Create a collection
        print("\n1. Creating a collection:")
        response = await client.post(
            f"{base_url}/collections",
            params={
                "name": "My Favorite Posts",
                "description": "A collection of my favorite posts",
                "is_public": True
            },
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            collection_data = response.json()
            print(f"Response: {collection_data}")
            collection_id = collection_data["collection_id"]
        else:
            print(f"Error: {response.text}")
            return
        
        # 2. Get my collections
        print("\n2. Getting my collections:")
        response = await client.get(
            f"{base_url}/collections",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # 3. Add post to collection
        print("\n3. Adding post to collection:")
        response = await client.post(
            f"{base_url}/collections/{collection_id}/posts/test_post_123",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # 4. Get collection with posts
        print("\n4. Getting collection with posts:")
        response = await client.get(
            f"{base_url}/collections/{collection_id}",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            collection_with_posts = response.json()
            print(f"Collection: {collection_with_posts['name']}")
            print(f"Posts count: {len(collection_with_posts.get('posts', []))}")
            if collection_with_posts.get('posts'):
                print(f"First post: {collection_with_posts['posts'][0]['content']}")
        else:
            print(f"Error: {response.text}")
        
        # 5. Get public collections
        print("\n5. Getting public collections:")
        response = await client.get(
            f"{base_url}/collections/public",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            public_collections = response.json()
            print(f"Public collections count: {len(public_collections)}")
            if public_collections:
                print(f"First collection: {public_collections[0]['name']}")
        else:
            print(f"Error: {response.text}")
        
        # 6. Update collection
        print("\n6. Updating collection:")
        response = await client.put(
            f"{base_url}/collections/{collection_id}",
            params={
                "name": "My Updated Favorite Posts",
                "description": "Updated description"
            },
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
        
        # 7. Remove post from collection
        print("\n7. Removing post from collection:")
        response = await client.delete(
            f"{base_url}/collections/{collection_id}/posts/test_post_123",
            headers={"Authorization": f"Bearer {test_user['session_token']}"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_collections())