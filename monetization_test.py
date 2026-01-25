#!/usr/bin/env python3
"""
Backend Testing Script for Optional Monetization Toggle Feature
Tests the monetization_enabled field and related endpoints
"""

import asyncio
import httpx
import json
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.getenv("EXPO_PUBLIC_BACKEND_URL", "https://mediashare-370.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, details=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")
        return self.failed == 0

class MonetizationTester:
    def __init__(self):
        self.results = TestResults()
        self.session_token = None
        self.user_id = None
        self.test_user_id = None  # For testing tips to another user
        
    async def authenticate(self):
        """Get valid session from database"""
        try:
            # Import MongoDB client
            from motor.motor_asyncio import AsyncIOMotorClient
            
            client = AsyncIOMotorClient('mongodb://localhost:27017')
            db = client['test_database']
            
            # Find a valid session that hasn't expired
            session = await db.user_sessions.find_one(
                {'expires_at': {'$gt': datetime.now()}},
                {'_id': 0}
            )
            
            client.close()
            
            if session:
                self.session_token = session['session_token']
                self.user_id = session['user_id']
                self.results.add_result("Authentication Setup", True, f"Authenticated as user {self.user_id}")
                return True
            else:
                self.results.add_result("Authentication Setup", False, "No valid sessions found in database")
                return False
                
        except Exception as e:
            self.results.add_result("Authentication Setup", False, f"Auth error: {str(e)}")
            return False
    
    async def test_monetization_field_in_profile(self):
        """Test 1: Test monetization_enabled field in user profile endpoints"""
        if not self.session_token:
            self.results.add_result("Profile Monetization Field Test", False, "No authentication token available")
            return
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with httpx.AsyncClient() as client:
            try:
                # Test GET /api/auth/me - should return monetization_enabled field
                response = await client.get(f"{API_BASE}/auth/me", headers=headers)
                if response.status_code == 200:
                    user_data = response.json()
                    has_monetization_field = "monetization_enabled" in user_data
                    monetization_value = user_data.get("monetization_enabled", None)
                    
                    if has_monetization_field:
                        self.results.add_result(
                            "GET /api/auth/me monetization_enabled field", 
                            True, 
                            f"Field present with value: {monetization_value}"
                        )
                    else:
                        self.results.add_result(
                            "GET /api/auth/me monetization_enabled field", 
                            False, 
                            "monetization_enabled field missing from user profile"
                        )
                else:
                    self.results.add_result(
                        "GET /api/auth/me monetization_enabled field", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}"
                    )
                
                # Test PUT /api/users/me with monetization_enabled=true
                response = await client.put(
                    f"{API_BASE}/users/me?monetization_enabled=true", 
                    headers=headers
                )
                if response.status_code == 200:
                    self.results.add_result(
                        "PUT /api/users/me monetization_enabled=true", 
                        True, 
                        "Successfully updated monetization to enabled"
                    )
                else:
                    self.results.add_result(
                        "PUT /api/users/me monetization_enabled=true", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}"
                    )
                
                # Test PUT /api/users/me with monetization_enabled=false
                response = await client.put(
                    f"{API_BASE}/users/me?monetization_enabled=false", 
                    headers=headers
                )
                if response.status_code == 200:
                    self.results.add_result(
                        "PUT /api/users/me monetization_enabled=false", 
                        True, 
                        "Successfully updated monetization to disabled"
                    )
                else:
                    self.results.add_result(
                        "PUT /api/users/me monetization_enabled=false", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                self.results.add_result("Profile Monetization Field Test", False, f"Exception: {str(e)}")
    
    async def test_tip_endpoint_monetization_disabled(self):
        """Test 2: Test tip endpoint with monetization disabled (should return 403)"""
        if not self.session_token:
            self.results.add_result("Tip Endpoint - Monetization Disabled", False, "No authentication token available")
            return
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with httpx.AsyncClient() as client:
            try:
                # First ensure monetization is disabled
                await client.put(
                    f"{API_BASE}/users/me", 
                    headers=headers,
                    params={"monetization_enabled": "false"}
                )
                
                # Create a test user to tip (or use current user for testing)
                target_user_id = self.user_id or "test_user_123"
                
                # Try to send a tip - should fail with 403
                response = await client.post(
                    f"{API_BASE}/users/{target_user_id}/tip",
                    headers=headers,
                    params={
                        "amount": 5.00,
                        "message": "Test tip with monetization disabled"
                    }
                )
                
                if response.status_code == 403:
                    response_data = response.json()
                    detail = response_data.get("detail", "")
                    if "monetization" in detail.lower():
                        self.results.add_result(
                            "Tip Endpoint - Monetization Disabled (403 Expected)", 
                            True, 
                            f"Correctly returned 403: {detail}"
                        )
                    else:
                        self.results.add_result(
                            "Tip Endpoint - Monetization Disabled (403 Expected)", 
                            False, 
                            f"Got 403 but wrong message: {detail}"
                        )
                else:
                    self.results.add_result(
                        "Tip Endpoint - Monetization Disabled (403 Expected)", 
                        False, 
                        f"Expected 403, got HTTP {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                self.results.add_result("Tip Endpoint - Monetization Disabled", False, f"Exception: {str(e)}")
    
    async def test_tip_endpoint_monetization_enabled(self):
        """Test 3: Test tip endpoint with monetization enabled (should work)"""
        if not self.session_token:
            self.results.add_result("Tip Endpoint - Monetization Enabled", False, "No authentication token available")
            return
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with httpx.AsyncClient() as client:
            try:
                # First ensure monetization is enabled
                put_response = await client.put(
                    f"{API_BASE}/users/me?monetization_enabled=true", 
                    headers=headers
                )
                print(f"   DEBUG: PUT response status: {put_response.status_code}")
                if put_response.status_code != 200:
                    print(f"   DEBUG: PUT response text: {put_response.text}")
                
                # Add a small delay to ensure the update is processed
                import asyncio
                await asyncio.sleep(1)
                
                # Verify the user's monetization status
                me_response = await client.get(f"{API_BASE}/auth/me", headers=headers)
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    monetization_status = user_data.get("monetization_enabled", False)
                    print(f"   DEBUG: User monetization_enabled status: {monetization_status}")
                    
                    # If still False, try a different approach
                    if not monetization_status:
                        print("   DEBUG: Trying alternative PUT format...")
                        put_response2 = await client.put(
                            f"{API_BASE}/users/me?monetization_enabled=true", 
                            headers=headers
                        )
                        print(f"   DEBUG: Alternative PUT response status: {put_response2.status_code}")
                        
                        # Check again
                        me_response2 = await client.get(f"{API_BASE}/auth/me", headers=headers)
                        if me_response2.status_code == 200:
                            user_data2 = me_response2.json()
                            monetization_status = user_data2.get("monetization_enabled", False)
                            print(f"   DEBUG: User monetization_enabled status after retry: {monetization_status}")
                
                # Create a test user to tip (or use current user for testing)
                target_user_id = self.user_id or "test_user_123"
                
                # Try to send a tip - should work now
                response = await client.post(
                    f"{API_BASE}/users/{target_user_id}/tip",
                    headers=headers,
                    params={
                        "amount": 5.00,
                        "message": "Test tip with monetization enabled"
                    }
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    self.results.add_result(
                        "Tip Endpoint - Monetization Enabled (200 Expected)", 
                        True, 
                        f"Successfully sent tip: {response_data.get('message', 'No message')}"
                    )
                elif response.status_code == 403:
                    response_data = response.json()
                    detail = response_data.get("detail", "")
                    self.results.add_result(
                        "Tip Endpoint - Monetization Enabled (200 Expected)", 
                        False, 
                        f"Still getting 403 after enabling monetization: {detail}"
                    )
                else:
                    self.results.add_result(
                        "Tip Endpoint - Monetization Enabled (200 Expected)", 
                        False, 
                        f"Unexpected HTTP {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                self.results.add_result("Tip Endpoint - Monetization Enabled", False, f"Exception: {str(e)}")
    
    async def test_subscription_tier_creation_monetization_disabled(self):
        """Test 4: Test subscription tier creation with monetization disabled (should return 403)"""
        if not self.session_token:
            self.results.add_result("Subscription Tier - Monetization Disabled", False, "No authentication token available")
            return
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with httpx.AsyncClient() as client:
            try:
                # First ensure monetization is disabled
                await client.put(
                    f"{API_BASE}/users/me", 
                    headers=headers,
                    params={"monetization_enabled": "false"}
                )
                
                target_user_id = self.user_id or "test_user_123"
                
                # Try to create subscription tier - should fail with 403
                tier_data = {
                    "name": "Test Tier",
                    "price": 9.99,
                    "description": "Test subscription tier",
                    "benefits": ["Exclusive content", "Early access"]
                }
                
                response = await client.post(
                    f"{API_BASE}/creators/{target_user_id}/subscription-tiers",
                    headers=headers,
                    json=tier_data
                )
                
                if response.status_code == 403:
                    response_data = response.json()
                    detail = response_data.get("detail", "")
                    if "monetization" in detail.lower():
                        self.results.add_result(
                            "Subscription Tier Creation - Monetization Disabled (403 Expected)", 
                            True, 
                            f"Correctly returned 403: {detail}"
                        )
                    else:
                        self.results.add_result(
                            "Subscription Tier Creation - Monetization Disabled (403 Expected)", 
                            False, 
                            f"Got 403 but wrong message: {detail}"
                        )
                else:
                    self.results.add_result(
                        "Subscription Tier Creation - Monetization Disabled (403 Expected)", 
                        False, 
                        f"Expected 403, got HTTP {response.status_code}: {response.text}"
                    )
                    
            except Exception as e:
                self.results.add_result("Subscription Tier - Monetization Disabled", False, f"Exception: {str(e)}")
    
    async def test_paid_content_creation_monetization_disabled(self):
        """Test 5: Test paid content creation with monetization disabled (should return 403)"""
        if not self.session_token:
            self.results.add_result("Paid Content - Monetization Disabled", False, "No authentication token available")
            return
            
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        async with httpx.AsyncClient() as client:
            try:
                # First ensure monetization is disabled
                await client.put(
                    f"{API_BASE}/users/me", 
                    headers=headers,
                    params={"monetization_enabled": "false"}
                )
                
                # First create a test post
                post_data = {
                    "content": "Test post for paid content feature"
                }
                
                response = await client.post(
                    f"{API_BASE}/posts",
                    headers=headers,
                    data=post_data
                )
                
                if response.status_code == 200:
                    post_response = response.json()
                    post_id = post_response.get("post_id")
                    
                    if post_id:
                        # Try to set post as paid - should fail with 403
                        response = await client.post(
                            f"{API_BASE}/posts/{post_id}/set-paid",
                            headers=headers,
                            params={
                                "price": 2.99,
                                "preview_content": "This is a preview..."
                            }
                        )
                        
                        if response.status_code == 403:
                            response_data = response.json()
                            detail = response_data.get("detail", "")
                            if "monetization" in detail.lower():
                                self.results.add_result(
                                    "Paid Content Creation - Monetization Disabled (403 Expected)", 
                                    True, 
                                    f"Correctly returned 403: {detail}"
                                )
                            else:
                                self.results.add_result(
                                    "Paid Content Creation - Monetization Disabled (403 Expected)", 
                                    False, 
                                    f"Got 403 but wrong message: {detail}"
                                )
                        else:
                            self.results.add_result(
                                "Paid Content Creation - Monetization Disabled (403 Expected)", 
                                False, 
                                f"Expected 403, got HTTP {response.status_code}: {response.text}"
                            )
                    else:
                        self.results.add_result(
                            "Paid Content Creation - Monetization Disabled", 
                            False, 
                            "Could not create test post - no post_id returned"
                        )
                else:
                    self.results.add_result(
                        "Paid Content Creation - Monetization Disabled", 
                        False, 
                        f"Could not create test post: HTTP {response.status_code}"
                    )
                    
            except Exception as e:
                self.results.add_result("Paid Content - Monetization Disabled", False, f"Exception: {str(e)}")
    
    async def test_backend_health(self):
        """Test backend health and connectivity"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{API_BASE}/health", timeout=10.0)
                if response.status_code == 200:
                    health_data = response.json()
                    self.results.add_result(
                        "Backend Health Check", 
                        True, 
                        f"Backend is healthy: {health_data.get('status', 'unknown')}"
                    )
                else:
                    self.results.add_result(
                        "Backend Health Check", 
                        False, 
                        f"Health check failed: HTTP {response.status_code}"
                    )
            except Exception as e:
                self.results.add_result("Backend Health Check", False, f"Connection error: {str(e)}")
    
    async def run_all_tests(self):
        """Run all monetization tests"""
        print("=== MONETIZATION TOGGLE FEATURE TESTING ===")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        print()
        
        # Test backend connectivity first
        await self.test_backend_health()
        
        # Try to authenticate
        auth_success = await self.authenticate()
        
        if auth_success:
            # Run all monetization tests
            await self.test_monetization_field_in_profile()
            await self.test_tip_endpoint_monetization_disabled()
            await self.test_tip_endpoint_monetization_enabled()
            await self.test_subscription_tier_creation_monetization_disabled()
            await self.test_paid_content_creation_monetization_disabled()
        else:
            print("⚠️  Authentication failed - running limited tests without auth")
            # We can still test some endpoints without auth to see if they properly reject
            await self.test_unauthenticated_endpoints()
        
        return self.results.summary()
    
    async def test_unauthenticated_endpoints(self):
        """Test endpoints without authentication to verify they return 401"""
        async with httpx.AsyncClient() as client:
            endpoints_to_test = [
                ("GET", f"{API_BASE}/auth/me", "GET /api/auth/me without auth"),
                ("PUT", f"{API_BASE}/users/me", "PUT /api/users/me without auth"),
                ("POST", f"{API_BASE}/users/test_user/tip", "POST tip endpoint without auth"),
                ("POST", f"{API_BASE}/creators/test_user/subscription-tiers", "Subscription tier creation without auth"),
            ]
            
            for method, url, test_name in endpoints_to_test:
                try:
                    if method == "GET":
                        response = await client.get(url)
                    elif method == "PUT":
                        response = await client.put(url, data={"monetization_enabled": "true"})
                    elif method == "POST":
                        response = await client.post(url, json={"test": "data"})
                    
                    if response.status_code == 401:
                        self.results.add_result(
                            f"{test_name} (401 Expected)", 
                            True, 
                            "Correctly returned 401 Unauthorized"
                        )
                    else:
                        self.results.add_result(
                            f"{test_name} (401 Expected)", 
                            False, 
                            f"Expected 401, got HTTP {response.status_code}"
                        )
                except Exception as e:
                    self.results.add_result(f"{test_name}", False, f"Exception: {str(e)}")

async def main():
    """Main test runner"""
    tester = MonetizationTester()
    success = await tester.run_all_tests()
    
    print("\n" + "="*50)
    if success:
        print("🎉 ALL TESTS PASSED!")
        exit(0)
    else:
        print("❌ SOME TESTS FAILED!")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())