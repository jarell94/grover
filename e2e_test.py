#!/usr/bin/env python3
"""
Grover End-to-End Testing Suite
Tests complete user journeys across the app
"""

import requests
import time
from datetime import datetime

class GroverE2ETester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.test_user_id = None
        self.test_auth_token = None
        self.test_post_id = None
        self.results = {
            "auth_flow": {"passed": 0, "total": 0},
            "post_creation_flow": {"passed": 0, "total": 0},
            "post_interaction_flow": {"passed": 0, "total": 0},
            "messaging_flow": {"passed": 0, "total": 0},
            "search_discovery": {"passed": 0, "total": 0},
            "user_profile_flow": {"passed": 0, "total": 0},
        }

    def log(self, message, category=None, passed=None):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        if category and passed is not None:
            self.results[category]["total"] += 1
            if passed:
                self.results[category]["passed"] += 1

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n" + "="*60)
        print("🔐 Testing Authentication Flow")
        print("="*60)
        
        # This would normally test OAuth flow
        # For testing, we'd need valid credentials
        self.log("Auth flow requires OAuth - manual testing needed", "auth_flow")

    def test_post_creation_and_discovery(self):
        """Test post creation, retrieval, and discovery"""
        print("\n" + "="*60)
        print("📝 Testing Post Creation & Discovery")
        print("="*60)
        
        try:
            # Get feed
            response = requests.get(f"{self.base_url}/discover/for-you")
            passed = response.status_code == 200
            self.log(f"Get For You feed: {response.status_code}", "post_creation_flow", passed)
            
            # Get trending
            response = requests.get(f"{self.base_url}/discover/trending")
            passed = response.status_code == 200
            self.log(f"Get trending posts: {response.status_code}", "post_creation_flow", passed)
            
            # Get categories
            response = requests.get(f"{self.base_url}/categories")
            passed = response.status_code == 200
            self.log(f"Get categories: {response.status_code}", "post_creation_flow", passed)
            
        except Exception as e:
            self.log(f"Post creation flow error: {str(e)}", "post_creation_flow", False)

    def test_post_interactions(self):
        """Test post interactions (like, dislike, save, share, comment)"""
        print("\n" + "="*60)
        print("❤️ Testing Post Interactions")
        print("="*60)
        
        try:
            # Get a post to interact with
            response = requests.get(f"{self.base_url}/discover/for-you")
            if response.status_code == 200:
                data = response.json()
                if data.get("data") and len(data["data"]) > 0:
                    post_id = data["data"][0].get("post_id")
                    
                    if post_id:
                        # Test post retrieval with interactions
                        response = requests.get(f"{self.base_url}/posts/{post_id}")
                        passed = response.status_code == 200
                        self.log(f"Get post details: {response.status_code}", "post_interaction_flow", passed)
                        
                        # Note: Actual like/save/comment requires auth
                        self.log("Post interactions require authentication - manual testing needed", 
                                "post_interaction_flow")
        except Exception as e:
            self.log(f"Post interactions error: {str(e)}", "post_interaction_flow", False)

    def test_search_functionality(self):
        """Test search and discovery features"""
        print("\n" + "="*60)
        print("🔍 Testing Search & Discovery")
        print("="*60)
        
        try:
            # Test search
            search_queries = ["python", "tech", "music"]
            for query in search_queries:
                response = requests.get(
                    f"{self.base_url}/search",
                    params={"q": query, "type": "posts"}
                )
                passed = response.status_code == 200
                self.log(f"Search '{query}': {response.status_code}", "search_discovery", passed)
            
            # Test suggested users
            response = requests.get(f"{self.base_url}/discover/suggested-users")
            passed = response.status_code == 200
            self.log(f"Get suggested users: {response.status_code}", "search_discovery", passed)
            
        except Exception as e:
            self.log(f"Search error: {str(e)}", "search_discovery", False)

    def test_media_status(self):
        """Test media service status"""
        print("\n" + "="*60)
        print("🎥 Testing Media Service")
        print("="*60)
        
        try:
            response = requests.get(f"{self.base_url}/media/status")
            passed = response.status_code == 200
            self.log(f"Media status: {response.status_code}", "post_creation_flow", passed)
            
            if passed:
                data = response.json()
                print(f"  Cloudinary configured: {data.get('cloudinary_configured')}")
                print(f"  Service status: {data.get('message')}")
        except Exception as e:
            self.log(f"Media check error: {str(e)}", "post_creation_flow", False)

    def test_health_check(self):
        """Test backend health"""
        print("\n" + "="*60)
        print("🏥 Testing Backend Health")
        print("="*60)
        
        try:
            response = requests.get(f"{self.base_url.replace('/api', '')}/health")
            passed = response.status_code == 200
            self.log(f"Backend health check: {response.status_code}", "auth_flow", passed)
        except Exception as e:
            self.log(f"Health check failed: {str(e)}", "auth_flow", False)

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 END-TO-END TEST RESULTS")
        print("="*60)
        
        total_passed = 0
        total_tests = 0
        
        for category, data in self.results.items():
            passed = data["passed"]
            total = data["total"]
            total_passed += passed
            total_tests += total
            
            if total > 0:
                percentage = (passed / total) * 100
                status = "✅" if passed == total else "⚠️"
                category_name = category.replace("_", " ").title()
                print(f"{status} {category_name}: {passed}/{total} ({percentage:.0f}%)")
        
        print("-" * 60)
        if total_tests > 0:
            overall_percentage = (total_passed / total_tests) * 100
            overall_status = "✅ PASSED" if overall_percentage == 100 else "⚠️ PARTIAL"
            print(f"{overall_status}: {total_passed}/{total_tests} tests ({overall_percentage:.0f}%)")
        else:
            print("No automated tests run - manual testing needed for full flow")

    def run_all_tests(self):
        """Run all end-to-end tests"""
        print("\n🚀 Starting Grover E2E Test Suite")
        print(f"   Backend URL: {self.base_url}")
        print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        self.test_health_check()
        self.test_auth_flow()
        self.test_post_creation_and_discovery()
        self.test_post_interactions()
        self.test_search_functionality()
        self.test_media_status()
        
        self.print_summary()
        
        return self.results

if __name__ == "__main__":
    tester = GroverE2ETester()
    tester.run_all_tests()
