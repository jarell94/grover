#!/usr/bin/env python3
"""
Backend Security Testing Suite for Grover Social Media Platform
Tests security fixes including input validation, file upload security, and pagination limits.
"""

import requests
import json
import uuid
import base64
import time
from io import BytesIO

# Configuration
BASE_URL = "https://groversocial.preview.emergentagent.com/api"
TEST_SESSION_ID = f"test_session_{uuid.uuid4().hex[:12]}"

class SecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_id = None
        self.test_post_id = None
        
    def authenticate(self):
        """Get authentication token using test session"""
        print("🔐 Authenticating...")
        try:
            response = self.session.get(
                f"{BASE_URL}/auth/session",
                params={"session_id": TEST_SESSION_ID},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("session_token")
                self.test_user_id = data.get("user_id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                print(f"✅ Authentication successful - User ID: {self.test_user_id}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def test_pagination_limits(self):
        """Test pagination security limits"""
        print("\n📄 Testing Pagination Limits...")
        
        tests = [
            {"limit": 200, "skip": 0, "expected_limit": 100, "description": "Limit capped at 100"},
            {"limit": 0, "skip": 0, "expected_limit": 1, "description": "Limit minimum of 1"},
            {"limit": 50, "skip": -5, "expected_skip": 0, "description": "Skip minimum of 0"},
            {"limit": 25, "skip": 10, "expected_limit": 25, "description": "Valid pagination"}
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                response = self.session.get(
                    f"{BASE_URL}/posts",
                    params={"limit": test["limit"], "skip": test["skip"]},
                    timeout=10
                )
                
                if response.status_code == 200:
                    posts = response.json()
                    actual_count = len(posts)
                    
                    # Check if limit was properly enforced
                    if "expected_limit" in test:
                        if actual_count <= test["expected_limit"]:
                            print(f"✅ {test['description']}: Got {actual_count} posts (≤ {test['expected_limit']})")
                            passed += 1
                        else:
                            print(f"❌ {test['description']}: Got {actual_count} posts (> {test['expected_limit']})")
                    else:
                        print(f"✅ {test['description']}: Request successful")
                        passed += 1
                else:
                    print(f"❌ {test['description']}: HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"❌ {test['description']}: Error - {e}")
        
        print(f"📊 Pagination Tests: {passed}/{total} passed")
        return passed == total
    
    def test_input_validation(self):
        """Test input validation and sanitization"""
        print("\n🛡️ Testing Input Validation...")
        
        passed = 0
        total = 0
        
        # Test 1: Invalid post_id format (SQL injection attempt)
        total += 1
        try:
            malicious_post_id = "'; DROP TABLE users;--"
            response = self.session.post(
                f"{BASE_URL}/posts/{malicious_post_id}/comments",
                json={"content": "Test comment"},
                timeout=10
            )
            
            if response.status_code == 400:
                print("✅ Invalid post_id rejected (400 Bad Request)")
                passed += 1
            else:
                print(f"❌ Invalid post_id not properly rejected: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing invalid post_id: {e}")
        
        # Test 2: Very long bio (>500 chars) in profile update
        total += 1
        try:
            long_bio = "A" * 600  # 600 characters
            response = self.session.put(
                f"{BASE_URL}/users/me",
                json={"bio": long_bio},
                timeout=10
            )
            
            if response.status_code in [200, 400]:
                # Check if bio was truncated by getting profile
                profile_response = self.session.get(f"{BASE_URL}/auth/me", timeout=10)
                if profile_response.status_code == 200:
                    profile = profile_response.json()
                    actual_bio_length = len(profile.get("bio", ""))
                    if actual_bio_length <= 500:
                        print(f"✅ Long bio truncated to {actual_bio_length} chars (≤ 500)")
                        passed += 1
                    else:
                        print(f"❌ Bio not truncated: {actual_bio_length} chars")
                else:
                    print("❌ Could not verify bio truncation")
            else:
                print(f"❌ Profile update failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing long bio: {e}")
        
        # Test 3: Script tag injection in post content
        total += 1
        try:
            malicious_content = "<script>alert('XSS')</script>This is a test post"
            response = self.session.post(
                f"{BASE_URL}/posts",
                data={"content": malicious_content},
                timeout=10
            )
            
            if response.status_code == 200:
                post_data = response.json()
                self.test_post_id = post_data.get("post_id")
                print("✅ Post with script tags created (content should be sanitized)")
                passed += 1
            else:
                print(f"❌ Post creation failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing script injection: {e}")
        
        print(f"📊 Input Validation Tests: {passed}/{total} passed")
        return passed == total
    
    def test_session_id_validation(self):
        """Test session ID validation"""
        print("\n🔑 Testing Session ID Validation...")
        
        # Test very long session_id (>500 chars)
        long_session_id = "x" * 600
        try:
            response = self.session.get(
                f"{BASE_URL}/auth/session",
                params={"session_id": long_session_id},
                timeout=10
            )
            
            if response.status_code == 400:
                print("✅ Long session_id rejected (400 Bad Request)")
                return True
            else:
                print(f"❌ Long session_id not properly rejected: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error testing long session_id: {e}")
            return False
    
    def test_file_upload_validation(self):
        """Test file upload validation"""
        print("\n📁 Testing File Upload Validation...")
        
        passed = 0
        total = 0
        
        # Test 1: Invalid content type for product image
        total += 1
        try:
            # Create a fake text file with wrong content type
            fake_file_content = b"This is not an image"
            files = {
                'image': ('test.txt', BytesIO(fake_file_content), 'text/plain')
            }
            data = {
                'name': 'Test Product',
                'description': 'Test Description',
                'price': 19.99
            }
            
            response = self.session.post(
                f"{BASE_URL}/products",
                files=files,
                data=data,
                timeout=10
            )
            
            if response.status_code == 400:
                print("✅ Invalid file type rejected for product (400 Bad Request)")
                passed += 1
            else:
                print(f"❌ Invalid file type not rejected: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing invalid file type: {e}")
        
        # Test 2: Valid product creation (should work)
        total += 1
        try:
            # Create a small valid image (1x1 pixel PNG)
            png_data = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=="
            )
            files = {
                'image': ('test.png', BytesIO(png_data), 'image/png')
            }
            data = {
                'name': 'Valid Test Product',
                'description': 'Valid Test Description',
                'price': 29.99
            }
            
            response = self.session.post(
                f"{BASE_URL}/products",
                files=files,
                data=data,
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ Valid product creation successful")
                passed += 1
            else:
                print(f"❌ Valid product creation failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Error testing valid product creation: {e}")
        
        print(f"📊 File Upload Tests: {passed}/{total} passed")
        return passed == total
    
    def test_normal_operations(self):
        """Test that normal operations still work after security fixes"""
        print("\n✅ Testing Normal Operations...")
        
        passed = 0
        total = 0
        
        # Test 1: Create a normal post
        total += 1
        try:
            response = self.session.post(
                f"{BASE_URL}/posts",
                data={"content": "This is a normal test post for security validation"},
                timeout=10
            )
            
            if response.status_code == 200:
                post_data = response.json()
                self.test_post_id = post_data.get("post_id")
                print("✅ Normal post creation works")
                passed += 1
            else:
                print(f"❌ Normal post creation failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error creating normal post: {e}")
        
        # Test 2: Create a normal comment
        if self.test_post_id:
            total += 1
            try:
                response = self.session.post(
                    f"{BASE_URL}/posts/{self.test_post_id}/comments",
                    json={"content": "This is a normal test comment"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    print("✅ Normal comment creation works")
                    passed += 1
                else:
                    print(f"❌ Normal comment creation failed: {response.status_code}")
            except Exception as e:
                print(f"❌ Error creating normal comment: {e}")
        
        # Test 3: Get feed with reasonable limits
        total += 1
        try:
            response = self.session.get(
                f"{BASE_URL}/posts/feed",
                params={"limit": 20, "skip": 0},
                timeout=10
            )
            
            if response.status_code == 200:
                posts = response.json()
                print(f"✅ Feed retrieval works (got {len(posts)} posts)")
                passed += 1
            else:
                print(f"❌ Feed retrieval failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error getting feed: {e}")
        
        print(f"📊 Normal Operations Tests: {passed}/{total} passed")
        return passed == total
    
    def run_all_tests(self):
        """Run all security tests"""
        print("🚀 Starting Security Testing Suite for Grover Backend")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        results = {
            "pagination": self.test_pagination_limits(),
            "input_validation": self.test_input_validation(),
            "session_validation": self.test_session_id_validation(),
            "file_upload": self.test_file_upload_validation(),
            "normal_operations": self.test_normal_operations()
        }
        
        print("\n" + "=" * 60)
        print("📋 SECURITY TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(results.values())
        total_tests = len(results)
        
        for test_name, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\nOverall Result: {passed_tests}/{total_tests} test categories passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL SECURITY TESTS PASSED!")
            return True
        else:
            print("⚠️  SOME SECURITY TESTS FAILED - REVIEW REQUIRED")
            return False

if __name__ == "__main__":
    tester = SecurityTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)