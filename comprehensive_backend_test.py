#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Grover Social Media App
Testing all requirements from the review request:
1. Comments System (create, get, reply, like, delete)
2. Post Interactions (dislike, save, share, get saved)
3. Tagging and Location in Posts
"""

import requests
import pymongo
import uuid
from datetime import datetime, timezone, timedelta

class GroverBackendTester:
    def __init__(self):
        self.base_url = "http://localhost:8001/api"
        self.user_id = None
        self.session_token = None
        self.test_post_id = None
        self.test_comment_id = None
        self.results = {
            "comments_system": {"passed": 0, "total": 0, "details": []},
            "post_interactions": {"passed": 0, "total": 0, "details": []},
            "tagging_location": {"passed": 0, "total": 0, "details": []},
            "error_handling": {"passed": 0, "total": 0, "details": []}
        }
        
    def log(self, message, test_category=None, passed=None):
        """Log test results"""
        print(message)
        if test_category and passed is not None:
            self.results[test_category]["total"] += 1
            if passed:
                self.results[test_category]["passed"] += 1
            self.results[test_category]["details"].append({
                "message": message,
                "passed": passed
            })
    
    def setup_test_user(self):
        """Create test user and session in MongoDB"""
        try:
            client = pymongo.MongoClient("mongodb://localhost:27017")
            db = client["test_database"]
            
            self.user_id = f"user_{uuid.uuid4().hex[:12]}"
            self.session_token = f"test_token_{uuid.uuid4().hex}"
            
            # Create test user
            test_user = {
                "user_id": self.user_id,
                "email": f"testuser_{uuid.uuid4().hex[:8]}@example.com",
                "name": "Test User",
                "picture": "https://example.com/avatar.jpg",
                "bio": "Test user for backend testing",
                "is_premium": False,
                "is_private": False,
                "created_at": datetime.now(timezone.utc)
            }
            
            db.users.insert_one(test_user)
            
            # Create session
            session_doc = {
                "user_id": self.user_id,
                "session_token": self.session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
                "created_at": datetime.now(timezone.utc)
            }
            
            db.user_sessions.insert_one(session_doc)
            client.close()
            
            # Verify authentication
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                self.log("✅ Test user setup successful")
                return True
            else:
                self.log("❌ Test user authentication failed")
                return False
                
        except Exception as e:
            self.log(f"❌ Test user setup failed: {e}")
            return False
    
    def cleanup_test_user(self):
        """Remove test user and session from MongoDB"""
        try:
            client = pymongo.MongoClient("mongodb://localhost:27017")
            db = client["test_database"]
            
            # Clean up all test data
            db.users.delete_one({"user_id": self.user_id})
            db.user_sessions.delete_one({"session_token": self.session_token})
            db.posts.delete_many({"user_id": self.user_id})
            db.comments.delete_many({"user_id": self.user_id})
            db.likes.delete_many({"user_id": self.user_id})
            db.dislikes.delete_many({"user_id": self.user_id})
            db.saved_posts.delete_many({"user_id": self.user_id})
            db.comment_likes.delete_many({"user_id": self.user_id})
            
            client.close()
            self.log("✅ Test cleanup completed")
            
        except Exception as e:
            self.log(f"⚠️ Cleanup error: {e}")
    
    def make_request(self, method, endpoint, data=None, params=None):
        """Make authenticated HTTP request"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == "POST":
                if data:
                    response = requests.post(url, data=data, headers=headers, timeout=10)
                elif params:
                    response = requests.post(url, params=params, headers=headers, timeout=10)
                else:
                    response = requests.post(url, headers=headers, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            self.log(f"Request error: {e}")
            return None
    
    def create_test_post(self):
        """Create a test post for comment testing"""
        post_data = {
            "content": "Test post for comprehensive backend testing",
            "tagged_users": self.user_id,
            "location": "San Francisco, CA"
        }
        
        response = self.make_request("POST", "/posts", data=post_data)
        
        if response and response.status_code == 200:
            result = response.json()
            self.test_post_id = result.get("post_id")
            self.log(f"✅ Test post created: {self.test_post_id}")
            return True
        else:
            self.log(f"❌ Test post creation failed: {response.status_code if response else 'No response'}")
            return False
    
    def test_comments_system(self):
        """Test complete comments system as per review request"""
        self.log("\n=== Testing Comments System ===")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "comments_system", False)
            return
        
        # Test 1: POST /api/posts/{post_id}/comments - Create a comment
        self.log("1. Testing comment creation...")
        comment_params = {"content": "This is a comprehensive test comment with detailed content!"}
        response = self.make_request("POST", f"/posts/{self.test_post_id}/comments", params=comment_params)
        
        if response and response.status_code == 200:
            result = response.json()
            self.test_comment_id = result.get("comment_id")
            self.log(f"✅ Comment created successfully: {self.test_comment_id}", "comments_system", True)
        else:
            self.log(f"❌ Comment creation failed: {response.status_code if response else 'No response'}", "comments_system", False)
            return
        
        # Test 2: GET /api/posts/{post_id}/comments - Get all comments for a post
        self.log("2. Testing get comments for post...")
        response = self.make_request("GET", f"/posts/{self.test_post_id}/comments")
        
        if response and response.status_code == 200:
            comments = response.json()
            if len(comments) > 0 and comments[0].get("comment_id") == self.test_comment_id:
                self.log(f"✅ Retrieved {len(comments)} comments successfully", "comments_system", True)
            else:
                self.log("❌ Comments data validation failed", "comments_system", False)
        else:
            self.log(f"❌ Get comments failed: {response.status_code if response else 'No response'}", "comments_system", False)
        
        # Test 3: POST /api/posts/{post_id}/comments with parent_comment_id - Create a reply
        self.log("3. Testing comment reply creation...")
        reply_params = {
            "content": "This is a reply to the test comment",
            "parent_comment_id": self.test_comment_id
        }
        response = self.make_request("POST", f"/posts/{self.test_post_id}/comments", params=reply_params)
        
        reply_id = None
        if response and response.status_code == 200:
            result = response.json()
            reply_id = result.get("comment_id")
            self.log(f"✅ Reply created successfully: {reply_id}", "comments_system", True)
        else:
            self.log(f"❌ Reply creation failed: {response.status_code if response else 'No response'}", "comments_system", False)
        
        # Test 4: GET /api/comments/{comment_id}/replies - Get replies for a comment
        self.log("4. Testing get comment replies...")
        response = self.make_request("GET", f"/comments/{self.test_comment_id}/replies")
        
        if response and response.status_code == 200:
            replies = response.json()
            if len(replies) > 0 and reply_id and replies[0].get("comment_id") == reply_id:
                self.log(f"✅ Retrieved {len(replies)} replies successfully", "comments_system", True)
            else:
                self.log("❌ Replies data validation failed", "comments_system", False)
        else:
            self.log(f"❌ Get replies failed: {response.status_code if response else 'No response'}", "comments_system", False)
        
        # Test 5: POST /api/comments/{comment_id}/like - Like/unlike a comment (toggle)
        self.log("5. Testing comment like (first time)...")
        response = self.make_request("POST", f"/comments/{self.test_comment_id}/like")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("liked") == True:
                self.log("✅ Comment liked successfully", "comments_system", True)
            else:
                self.log("❌ Comment like response validation failed", "comments_system", False)
        else:
            self.log(f"❌ Comment like failed: {response.status_code if response else 'No response'}", "comments_system", False)
        
        # Test 6: POST /api/comments/{comment_id}/like - Unlike (toggle)
        self.log("6. Testing comment unlike (toggle)...")
        response = self.make_request("POST", f"/comments/{self.test_comment_id}/like")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("liked") == False:
                self.log("✅ Comment unliked successfully (toggle working)", "comments_system", True)
            else:
                self.log("❌ Comment unlike toggle failed", "comments_system", False)
        else:
            self.log(f"❌ Comment unlike failed: {response.status_code if response else 'No response'}", "comments_system", False)
        
        # Test 7: DELETE /api/comments/{comment_id} - Delete own comment
        self.log("7. Testing comment deletion...")
        response = self.make_request("DELETE", f"/comments/{self.test_comment_id}")
        
        if response and response.status_code == 200:
            self.log("✅ Comment deleted successfully", "comments_system", True)
        else:
            self.log(f"❌ Comment deletion failed: {response.status_code if response else 'No response'}", "comments_system", False)
    
    def test_post_interactions(self):
        """Test post interactions as per review request"""
        self.log("\n=== Testing Post Interactions ===")
        
        if not self.test_post_id:
            self.log("❌ No test post available", "post_interactions", False)
            return
        
        # Test 1: POST /api/posts/{post_id}/dislike - Dislike/undislike a post (toggle)
        self.log("1. Testing post dislike...")
        response = self.make_request("POST", f"/posts/{self.test_post_id}/dislike")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("disliked") == True:
                self.log("✅ Post disliked successfully", "post_interactions", True)
            else:
                self.log("❌ Post dislike response validation failed", "post_interactions", False)
        else:
            self.log(f"❌ Post dislike failed: {response.status_code if response else 'No response'}", "post_interactions", False)
        
        # Test 2: POST /api/posts/{post_id}/dislike - Undislike (toggle)
        self.log("2. Testing post undislike (toggle)...")
        response = self.make_request("POST", f"/posts/{self.test_post_id}/dislike")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("disliked") == False:
                self.log("✅ Post undisliked successfully (toggle working)", "post_interactions", True)
            else:
                self.log("❌ Post undislike toggle failed", "post_interactions", False)
        else:
            self.log(f"❌ Post undislike failed: {response.status_code if response else 'No response'}", "post_interactions", False)
        
        # Test 3: POST /api/posts/{post_id}/save - Save/unsave a post (toggle, bookmark)
        self.log("3. Testing post save (bookmark)...")
        response = self.make_request("POST", f"/posts/{self.test_post_id}/save")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("saved") == True:
                self.log("✅ Post saved successfully (bookmarked)", "post_interactions", True)
            else:
                self.log("❌ Post save response validation failed", "post_interactions", False)
        else:
            self.log(f"❌ Post save failed: {response.status_code if response else 'No response'}", "post_interactions", False)
        
        # Test 4: GET /api/posts/saved - Get all saved posts for the current user
        self.log("4. Testing get saved posts...")
        response = self.make_request("GET", "/posts/saved")
        
        if response and response.status_code == 200:
            saved_posts = response.json()
            if len(saved_posts) > 0 and any(post.get("post_id") == self.test_post_id for post in saved_posts):
                self.log(f"✅ Retrieved {len(saved_posts)} saved posts, test post found", "post_interactions", True)
            else:
                self.log("❌ Saved posts validation failed - test post not found", "post_interactions", False)
        else:
            self.log(f"❌ Get saved posts failed: {response.status_code if response else 'No response'}", "post_interactions", False)
        
        # Test 5: POST /api/posts/{post_id}/share - Share a post
        self.log("5. Testing post share...")
        response = self.make_request("POST", f"/posts/{self.test_post_id}/share")
        
        if response and response.status_code == 200:
            result = response.json()
            if "shares_count" in result:
                self.log(f"✅ Post shared successfully, shares count: {result.get('shares_count')}", "post_interactions", True)
            else:
                self.log("❌ Post share response validation failed", "post_interactions", False)
        else:
            self.log(f"❌ Post share failed: {response.status_code if response else 'No response'}", "post_interactions", False)
        
        # Test 6: POST /api/posts/{post_id}/save - Unsave (toggle)
        self.log("6. Testing post unsave (toggle)...")
        response = self.make_request("POST", f"/posts/{self.test_post_id}/save")
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("saved") == False:
                self.log("✅ Post unsaved successfully (toggle working)", "post_interactions", True)
            else:
                self.log("❌ Post unsave toggle failed", "post_interactions", False)
        else:
            self.log(f"❌ Post unsave failed: {response.status_code if response else 'No response'}", "post_interactions", False)
    
    def test_tagging_and_location(self):
        """Test tagging and location features as per review request"""
        self.log("\n=== Testing Tagging and Location ===")
        
        # Test 1: POST /api/posts with tagged_users and location fields
        self.log("1. Testing post creation with tagging and location...")
        post_data = {
            "content": "Test post with comprehensive tagging and location features",
            "tagged_users": f"{self.user_id},user_fake123,user_fake456",  # Multiple tags
            "location": "Golden Gate Bridge, San Francisco, CA, USA"
        }
        
        response = self.make_request("POST", "/posts", data=post_data)
        tagged_post_id = None
        
        if response and response.status_code == 200:
            result = response.json()
            tagged_post_id = result.get("post_id")
            self.log(f"✅ Tagged post created successfully: {tagged_post_id}", "tagging_location", True)
        else:
            self.log(f"❌ Tagged post creation failed: {response.status_code if response else 'No response'}", "tagging_location", False)
            return
        
        # Test 2: Verify posts return with tagged_users and location in response
        self.log("2. Testing post data retrieval with tags and location...")
        response = self.make_request("GET", "/posts/feed")
        
        if response and response.status_code == 200:
            posts = response.json()
            tagged_post = None
            
            for post in posts:
                if post.get("post_id") == tagged_post_id:
                    tagged_post = post
                    break
            
            if tagged_post:
                location = tagged_post.get("location")
                tagged_users = tagged_post.get("tagged_users", [])
                
                location_valid = location == "Golden Gate Bridge, San Francisco, CA, USA"
                tags_valid = len(tagged_users) == 3 and self.user_id in tagged_users
                
                if location_valid and tags_valid:
                    self.log(f"✅ Post data validation successful - Location: {location}, Tags: {len(tagged_users)}", "tagging_location", True)
                else:
                    self.log(f"❌ Post data validation failed - Location: {location}, Tags: {tagged_users}", "tagging_location", False)
            else:
                self.log("❌ Tagged post not found in feed", "tagging_location", False)
        else:
            self.log(f"❌ Get posts feed failed: {response.status_code if response else 'No response'}", "tagging_location", False)
        
        # Test 3: Test edge cases - empty tags and location
        self.log("3. Testing edge cases (empty tags and location)...")
        edge_post_data = {
            "content": "Post with empty tags and location",
            "tagged_users": "",
            "location": ""
        }
        
        response = self.make_request("POST", "/posts", data=edge_post_data)
        
        if response and response.status_code == 200:
            self.log("✅ Post creation with empty tags/location successful", "tagging_location", True)
        else:
            self.log(f"❌ Edge case test failed: {response.status_code if response else 'No response'}", "tagging_location", False)
    
    def test_error_handling(self):
        """Test error handling and edge cases"""
        self.log("\n=== Testing Error Handling ===")
        
        # Test 1: Comment on non-existent post
        self.log("1. Testing comment on non-existent post...")
        fake_post_id = "post_nonexistent123"
        comment_params = {"content": "This should fail"}
        
        response = self.make_request("POST", f"/posts/{fake_post_id}/comments", params=comment_params)
        
        if response and response.status_code == 404:
            self.log("✅ Correctly returned 404 for non-existent post", "error_handling", True)
        else:
            self.log(f"❌ Expected 404, got: {response.status_code if response else 'No response'}", "error_handling", False)
        
        # Test 2: Like non-existent comment
        self.log("2. Testing like on non-existent comment...")
        fake_comment_id = "comment_nonexistent123"
        
        response = self.make_request("POST", f"/comments/{fake_comment_id}/like")
        
        if response and response.status_code == 404:
            self.log("✅ Correctly returned 404 for non-existent comment", "error_handling", True)
        else:
            self.log(f"❌ Expected 404, got: {response.status_code if response else 'No response'}", "error_handling", False)
        
        # Test 3: Interact with non-existent post
        self.log("3. Testing interactions on non-existent post...")
        fake_post_id = "post_nonexistent456"
        
        response = self.make_request("POST", f"/posts/{fake_post_id}/dislike")
        
        if response and response.status_code == 404:
            self.log("✅ Correctly returned 404 for non-existent post interaction", "error_handling", True)
        else:
            self.log(f"❌ Expected 404, got: {response.status_code if response else 'No response'}", "error_handling", False)
    
    def print_summary(self):
        """Print comprehensive test summary"""
        self.log("\n" + "="*60)
        self.log("🏁 COMPREHENSIVE BACKEND TEST RESULTS")
        self.log("="*60)
        
        total_passed = 0
        total_tests = 0
        
        for category, data in self.results.items():
            passed = data["passed"]
            total = data["total"]
            total_passed += passed
            total_tests += total
            
            status = "✅ PASSED" if passed == total else "❌ FAILED"
            category_name = category.replace("_", " ").title()
            self.log(f"{category_name}: {passed}/{total} {status}")
        
        self.log("-" * 60)
        overall_status = "✅ ALL TESTS PASSED" if total_passed == total_tests else "⚠️ SOME TESTS FAILED"
        self.log(f"OVERALL: {total_passed}/{total_tests} {overall_status}")
        
        return total_passed == total_tests
    
    def run_comprehensive_tests(self):
        """Run all comprehensive backend tests"""
        self.log("🚀 Starting Comprehensive Grover Backend Testing")
        self.log("Testing: Comments System, Post Interactions, Tagging & Location")
        self.log("="*60)
        
        # Setup
        if not self.setup_test_user():
            return False
        
        if not self.create_test_post():
            self.cleanup_test_user()
            return False
        
        # Run all test suites
        self.test_comments_system()
        self.test_post_interactions()
        self.test_tagging_and_location()
        self.test_error_handling()
        
        # Results
        success = self.print_summary()
        
        # Cleanup
        self.cleanup_test_user()
        
        return success

if __name__ == "__main__":
    tester = GroverBackendTester()
    success = tester.run_comprehensive_tests()
    exit(0 if success else 1)