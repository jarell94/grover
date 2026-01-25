#!/usr/bin/env python3
"""
Performance monitoring script for Grover app
Tracks API response times and database query performance
"""

import asyncio
import time
import httpx
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def test_api_performance():
    """Test API endpoint performance"""
    
    base_url = "http://192.168.1.101:8001/api"
    
    # Test endpoints with different pagination sizes
    endpoints = [
        ("/posts/feed?limit=10&skip=0", "Feed (10 items)"),
        ("/posts/feed?limit=20&skip=0", "Feed (20 items)"),
        ("/posts/feed?limit=50&skip=0", "Feed (50 items)"),
        ("/posts/explore?limit=10&skip=0", "Explore (10 items)"),
        ("/posts/explore?limit=20&skip=0", "Explore (20 items)"),
        ("/posts?limit=10&skip=0", "Posts (10 items)"),
        ("/posts?limit=20&skip=0", "Posts (20 items)"),
    ]
    
    print("🚀 API Performance Test Results")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        for endpoint, name in endpoints:
            try:
                # Warm up request
                await client.get(f"{base_url}{endpoint}")
                
                # Measure performance over 5 requests
                times = []
                for _ in range(5):
                    start_time = time.time()
                    response = await client.get(f"{base_url}{endpoint}")
                    end_time = time.time()
                    
                    if response.status_code == 200:
                        times.append((end_time - start_time) * 1000)  # Convert to ms
                    else:
                        print(f"❌ {name}: HTTP {response.status_code}")
                        break
                
                if times:
                    avg_time = sum(times) / len(times)
                    min_time = min(times)
                    max_time = max(times)
                    
                    status = "🟢" if avg_time < 100 else "🟡" if avg_time < 300 else "🔴"
                    print(f"{status} {name:<20}: {avg_time:.1f}ms avg (min: {min_time:.1f}ms, max: {max_time:.1f}ms)")
                    
            except Exception as e:
                print(f"❌ {name}: Error - {e}")

async def test_database_performance():
    """Test database query performance"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("\n📊 Database Performance Test Results")
    print("=" * 50)
    
    # Test different query patterns
    queries = [
        ("Posts by created_at", lambda: db.posts.find({}).sort("created_at", -1).limit(20).to_list(20)),
        ("Posts recent (basic query)", lambda: db.posts.find({}).sort("created_at", -1).limit(10).to_list(10)),
        ("User follows lookup", lambda: db.follows.find({"follower_id": "user_test"}).to_list(100)),
        ("Reactions by post", lambda: db.reactions.find({"post_id": "post_test"}).to_list(100)),
        ("Comments by post", lambda: db.comments.find({"post_id": "post_test"}).sort("created_at", -1).to_list(50)),
        ("User notifications", lambda: db.notifications.find({"user_id": "user_test"}).sort("created_at", -1).limit(20).to_list(20)),
    ]
    
    for name, query_func in queries:
        try:
            # Warm up query
            await query_func()
            
            # Measure performance over 5 queries
            times = []
            for _ in range(5):
                start_time = time.time()
                await query_func()
                end_time = time.time()
                times.append((end_time - start_time) * 1000)  # Convert to ms
            
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            
            status = "🟢" if avg_time < 50 else "🟡" if avg_time < 150 else "🔴"
            print(f"{status} {name:<25}: {avg_time:.1f}ms avg (min: {min_time:.1f}ms, max: {max_time:.1f}ms)")
            
        except Exception as e:
            print(f"❌ {name}: Error - {e}")
    
    # Close connection
    client.close()

async def check_indexes():
    """Check if database indexes are properly created"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("\n🔍 Database Index Status")
    print("=" * 50)
    
    collections = [
        "posts", "users", "follows", "reactions", "comments", 
        "notifications", "messages", "conversations", "products", "orders"
    ]
    
    for collection_name in collections:
        try:
            collection = db[collection_name]
            indexes = await collection.list_indexes().to_list(None)
            
            index_count = len(indexes)
            status = "🟢" if index_count > 1 else "🟡" if index_count == 1 else "🔴"
            
            print(f"{status} {collection_name:<15}: {index_count} indexes")
            
            # Show index details for important collections
            if collection_name in ["posts", "users", "follows"] and index_count > 1:
                for idx in indexes:
                    if idx['name'] != '_id_':
                        keys = list(idx['key'].keys())
                        print(f"    └─ {', '.join(keys)}")
                        
        except Exception as e:
            print(f"❌ {collection_name}: Error - {e}")
    
    # Close connection
    client.close()

async def main():
    """Run all performance tests"""
    
    print("🎯 Grover App Performance Monitor")
    print("=" * 50)
    
    # Check database indexes first
    await check_indexes()
    
    # Test database performance
    await test_database_performance()
    
    # Test API performance
    await test_api_performance()
    
    print("\n✅ Performance monitoring complete!")
    print("\nPerformance Guidelines:")
    print("🟢 Excellent: API < 100ms, DB < 50ms")
    print("🟡 Good: API < 300ms, DB < 150ms") 
    print("🔴 Needs optimization: API > 300ms, DB > 150ms")

if __name__ == "__main__":
    asyncio.run(main())