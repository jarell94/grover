#!/usr/bin/env python3
"""
Detailed Backend Endpoint Testing for Grover Social Media App
Investigates specific endpoint failures and provides detailed analysis
"""

import asyncio
import aiohttp
import json
from datetime import datetime

BASE_URL = "https://build-rescue-8.preview.emergentagent.com/api"

async def test_specific_endpoints():
    """Test specific endpoints that showed issues"""
    
    async with aiohttp.ClientSession() as session:
        print("🔍 DETAILED ENDPOINT INVESTIGATION")
        print("=" * 50)
        
        # Test notifications endpoints
        print("\n📢 NOTIFICATIONS ENDPOINTS:")
        notifications_endpoints = [
            ('GET', '/notifications'),
            ('POST', '/notifications/mark-all-read'),
            ('POST', '/notifications/mark-read/test_notif_123')
        ]
        
        for method, endpoint in notifications_endpoints:
            try:
                async with session.request(method, f"{BASE_URL}{endpoint}") as response:
                    print(f"  {method} {endpoint}: {response.status}")
                    if response.status not in [401, 404]:
                        text = await response.text()
                        print(f"    Response: {text[:100]}...")
            except Exception as e:
                print(f"  {method} {endpoint}: ERROR - {e}")
        
        # Test stories endpoints
        print("\n📚 STORIES ENDPOINTS:")
        stories_endpoints = [
            ('GET', '/stories'),
            ('POST', '/stories'),
            ('GET', '/stories/me'),
            ('POST', '/stories/test_story_123/view')
        ]
        
        for method, endpoint in stories_endpoints:
            try:
                async with session.request(method, f"{BASE_URL}{endpoint}") as response:
                    print(f"  {method} {endpoint}: {response.status}")
                    if response.status not in [401, 404]:
                        text = await response.text()
                        print(f"    Response: {text[:100]}...")
            except Exception as e:
                print(f"  {method} {endpoint}: ERROR - {e}")
        
        # Test authentication endpoint with different session IDs
        print("\n🔐 AUTHENTICATION TESTING:")
        auth_tests = [
            ("empty", ""),
            ("short", "abc"),
            ("normal", "test_session_123456789"),
            ("long", "x" * 600)
        ]
        
        for test_name, session_id in auth_tests:
            try:
                async with session.get(f"{BASE_URL}/auth/session?session_id={session_id}") as response:
                    print(f"  {test_name} session_id: {response.status}")
                    if response.status != 400:
                        text = await response.text()
                        print(f"    Response: {text[:100]}...")
            except Exception as e:
                print(f"  {test_name} session_id: ERROR - {e}")
        
        # Test CORS headers specifically
        print("\n🌐 CORS HEADERS TESTING:")
        cors_endpoints = ['/health', '/ready', '/media/status']
        
        for endpoint in cors_endpoints:
            try:
                async with session.options(f"{BASE_URL}{endpoint}") as response:
                    print(f"  OPTIONS {endpoint}: {response.status}")
                    cors_headers = {
                        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
                    }
                    print(f"    CORS Headers: {cors_headers}")
            except Exception as e:
                print(f"  OPTIONS {endpoint}: ERROR - {e}")
        
        # Test rate limiting with rapid requests
        print("\n⚡ RATE LIMITING TESTING:")
        start_time = datetime.now()
        statuses = []
        
        for i in range(20):
            try:
                async with session.get(f"{BASE_URL}/health") as response:
                    statuses.append(response.status)
            except Exception as e:
                statuses.append(f"ERROR: {e}")
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"  20 requests in {duration:.2f} seconds")
        print(f"  Status codes: {set(statuses)}")
        rate_limited = any(status == 429 for status in statuses)
        print(f"  Rate limiting detected: {rate_limited}")
        
        # Test server error handling
        print("\n🚨 ERROR HANDLING TESTING:")
        error_tests = [
            ('GET', '/posts/invalid_post_id_that_does_not_exist'),
            ('GET', '/users/invalid_user_id_that_does_not_exist'),
            ('POST', '/posts', '{"malformed": json}'),
            ('GET', '/nonexistent/endpoint/path')
        ]
        
        for method, endpoint, *data in error_tests:
            try:
                kwargs = {}
                if data:
                    kwargs['data'] = data[0]
                    kwargs['headers'] = {'Content-Type': 'application/json'}
                
                async with session.request(method, f"{BASE_URL}{endpoint}", **kwargs) as response:
                    print(f"  {method} {endpoint}: {response.status}")
                    if response.status >= 500:
                        text = await response.text()
                        print(f"    ⚠️ Server Error: {text[:100]}...")
            except Exception as e:
                print(f"  {method} {endpoint}: ERROR - {e}")

if __name__ == "__main__":
    asyncio.run(test_specific_endpoints())