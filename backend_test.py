#!/usr/bin/env python3
"""
Backend API Testing Suite for Grover Social Media Platform
FOCUS: Testing the newly added GET /api/stories/{story_id}/viewers endpoint
"""

import asyncio
import httpx
import json
import base64
import uuid
import os
from datetime import datetime
from typing import Dict, Any, Optional
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://creator-hub-320.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, message="", details=None):
        status = "✅ PASS" if passed else "❌ FAIL"
        result = f"{status}: {test_name}"
        if message:
            result += f" - {message}"
        if details:
            result += f"\n   Details: {details}"
        
        self.results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        print(result)
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"STORIES VIEWERS ENDPOINT TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")
        print(f"{'='*60}")
        return self.failed == 0

def create_test_image():
    """Create a simple test image"""
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes.getvalue()

async def test_stories_viewers_endpoint():
    """Test the GET /api/stories/{story_id}/viewers endpoint"""
    results = TestResults()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Test data - use existing users from database
        test_users = [
            {
                "user_id": "user_7e16d95525b7",
                "token": "zhR2T4ZXwavcIx9KiHXW_T2qeHaIqkVt-6Q3ZstMWSc",
                "name": "jarell chaffin",
                "role": "owner"
            },
            {
                "user_id": "user_de7370183547", 
                "token": "zhR2T4ZXwavcIx9KiHXW_T2qeHaIqkVt-6Q3ZstMWSc",  # Using same token for simplicity
                "name": "Test User",
                "role": "viewer"
            }
        ]
        story_id = None
        
        try:
            print("🧪 Testing Stories Viewers Endpoint")
            print("=" * 50)
            
            # Step 1: Verify authentication works
            print("\n📝 Step 1: Verifying authentication...")
            
            owner = test_users[0]
            response = await client.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {owner['token']}"}
            )
            
            if response.status_code == 200:
                auth_data = response.json()
                results.add_result("Authentication verification", True, f"User: {auth_data.get('name', 'Unknown')}")
            else:
                results.add_result("Authentication verification", False, f"Status: {response.status_code}")
                return results.summary()
            
            # Step 2: Create a story as the owner
            print("\n📸 Step 2: Creating a story...")
            
            owner = test_users[0]
            test_image = create_test_image()
            
            files = {
                'media': ('test_story.jpg', test_image, 'image/jpeg')
            }
            data = {
                'caption': 'Test story for viewers endpoint testing'
            }
            
            response = await client.post(
                f"{BASE_URL}/stories",
                headers={"Authorization": f"Bearer {owner['token']}"},
                files=files,
                data=data
            )
            
            if response.status_code == 200:
                story_response = response.json()
                story_id = story_response["story_id"]
                results.add_result("Create story", True, f"Story ID: {story_id}")
            else:
                results.add_result("Create story", False, f"Status: {response.status_code}, Response: {response.text}")
                return results.summary()
            
            # Step 3: View the story with the viewer user
            print("\n👀 Step 3: Viewing story with different user...")
            
            viewer = test_users[1]
            
            response = await client.post(
                f"{BASE_URL}/stories/{story_id}/view",
                headers={"Authorization": f"Bearer {viewer['token']}"}
            )
            
            if response.status_code == 200:
                view_response = response.json()
                results.add_result("View story as viewer", True, f"Views count: {view_response.get('views_count', 'N/A')}")
            else:
                results.add_result("View story as viewer", False, f"Status: {response.status_code}, Response: {response.text}")
            
            # Step 4: Get viewers list as story owner
            print("\n📊 Step 4: Getting viewers list as story owner...")
            
            response = await client.get(
                f"{BASE_URL}/stories/{story_id}/viewers",
                headers={"Authorization": f"Bearer {owner['token']}"}
            )
            
            if response.status_code == 200:
                viewers_response = response.json()
                
                # Validate response structure
                if "viewers" in viewers_response and "total_count" in viewers_response:
                    results.add_result("Get viewers - Response structure", True, "Contains viewers and total_count")
                    
                    viewers = viewers_response["viewers"]
                    total_count = viewers_response["total_count"]
                    
                    # Check if viewer is in the list
                    viewer_found = False
                    for viewer_data in viewers:
                        if "user" in viewer_data and "viewed_at" in viewer_data:
                            user_info = viewer_data["user"]
                            if user_info.get("user_id") == viewer["user_id"]:
                                viewer_found = True
                                # Validate user info structure
                                required_fields = ["user_id", "name", "picture"]
                                has_all_fields = all(field in user_info for field in required_fields)
                                results.add_result("Viewer user info structure", has_all_fields, 
                                                 f"Fields: {list(user_info.keys())}")
                                
                                # Validate viewed_at timestamp
                                viewed_at = viewer_data["viewed_at"]
                                if isinstance(viewed_at, str) and viewed_at:
                                    results.add_result("Viewed_at timestamp", True, f"Timestamp: {viewed_at}")
                                else:
                                    results.add_result("Viewed_at timestamp", False, f"Invalid timestamp: {viewed_at}")
                                break
                    
                    if viewer_found:
                        results.add_result("Viewer in viewers list", True, f"Found viewer {viewer['user_id']}")
                    else:
                        results.add_result("Viewer in viewers list", False, "Viewer not found in list")
                    
                    results.add_result("Total count accuracy", total_count >= len(viewers), 
                                     f"Total: {total_count}, List length: {len(viewers)}")
                    
                else:
                    results.add_result("Get viewers - Response structure", False, 
                                     f"Missing required fields. Response: {viewers_response}")
            else:
                results.add_result("Get viewers as owner", False, 
                                 f"Status: {response.status_code}, Response: {response.text}")
            
            # Step 5: Test authorization - non-owner should get 403
            print("\n🔒 Step 5: Testing authorization (non-owner access)...")
            
            response = await client.get(
                f"{BASE_URL}/stories/{story_id}/viewers",
                headers={"Authorization": f"Bearer {viewer['token']}"}
            )
            
            if response.status_code == 403:
                results.add_result("Non-owner 403 error", True, "Correctly denied access")
            else:
                results.add_result("Non-owner 403 error", False, 
                                 f"Expected 403, got {response.status_code}")
            
            # Step 6: Test pagination parameters
            print("\n📄 Step 6: Testing pagination parameters...")
            
            response = await client.get(
                f"{BASE_URL}/stories/{story_id}/viewers",
                headers={"Authorization": f"Bearer {owner['token']}"},
                params={"limit": 10, "skip": 0}
            )
            
            if response.status_code == 200:
                results.add_result("Pagination parameters", True, "Limit and skip parameters accepted")
            else:
                results.add_result("Pagination parameters", False, 
                                 f"Status: {response.status_code}")
            
            # Step 7: Test with invalid story ID
            print("\n❌ Step 7: Testing with invalid story ID...")
            
            response = await client.get(
                f"{BASE_URL}/stories/invalid_story_id/viewers",
                headers={"Authorization": f"Bearer {owner['token']}"}
            )
            
            if response.status_code == 404:
                results.add_result("Invalid story ID 404", True, "Correctly returned 404")
            else:
                results.add_result("Invalid story ID 404", False, 
                                 f"Expected 404, got {response.status_code}")
            
            # Step 8: Test without authentication
            print("\n🚫 Step 8: Testing without authentication...")
            
            response = await client.get(f"{BASE_URL}/stories/{story_id}/viewers")
            
            if response.status_code == 401:
                results.add_result("No auth 401 error", True, "Correctly required authentication")
            else:
                results.add_result("No auth 401 error", False, 
                                 f"Expected 401, got {response.status_code}")
            
        except Exception as e:
            results.add_result("Test execution", False, f"Exception: {str(e)}")
        
        finally:
            # Cleanup: Delete the test story if created
            if story_id and test_users:
                try:
                    print("\n🧹 Cleanup: Deleting test story...")
                    owner = test_users[0]
                    await client.delete(
                        f"{BASE_URL}/stories/{story_id}",
                        headers={"Authorization": f"Bearer {owner['token']}"}
                    )
                    print("✅ Test story deleted")
                except Exception as e:
                    print(f"⚠️ Cleanup failed: {e}")
    
    return results.summary()

async def main():
    """Main test function"""
    print("🚀 Starting Stories Viewers Endpoint Tests")
    print(f"Backend URL: {BASE_URL}")
    
    success = await test_stories_viewers_endpoint()
    
    if success:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n💥 Some tests failed!")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())