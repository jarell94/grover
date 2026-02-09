#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Grover Social Media App
Production Deployment Bug Scanning and Testing

Test Categories:
1. Authentication & Security
2. Core API Endpoints
3. Media Upload
4. Database Operations
5. Payment Integration
6. Live Streaming
7. Error Handling
8. Edge Cases
"""

import asyncio
import aiohttp
import json
import base64
import uuid
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

# Configuration
BASE_URL = "https://grover-social-1.preview.emergentagent.com/api"
TEST_USER_EMAIL = "testuser@grover.com"
TEST_USER_NAME = "Test User"

class GroverBackendTester:
    def __init__(self):
        self.session = None
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        self.created_resources = {
            'posts': [],
            'products': [],
            'comments': [],
            'stories': [],
            'streams': [],
            'discounts': []
        }
    
    async def setup(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        print("🚀 Starting Grover Backend Testing Suite")
        print(f"📡 Base URL: {BASE_URL}")
        print("=" * 60)
    
    async def cleanup(self):
        """Clean up resources"""
        if self.session:
            await self.session.close()
        print("\n" + "=" * 60)
        print("🧹 Cleanup completed")
    
    def log_test(self, test_name: str, status: str, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_emoji} {test_name}: {status}")
        if details:
            print(f"   📝 {details}")
        if status == "FAIL" and response_data:
            print(f"   🔍 Response: {response_data}")
    
    async def make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        kwargs['headers'] = headers
        
        try:
            async with self.session.request(method, url, **kwargs) as response:
                try:
                    data = await response.json()
                except:
                    data = await response.text()
                
                return {
                    'status': response.status,
                    'data': data,
                    'headers': dict(response.headers)
                }
        except Exception as e:
            return {
                'status': 0,
                'data': str(e),
                'headers': {}
            }
    
    # ============ AUTHENTICATION & SECURITY TESTS ============
    
    async def test_health_check(self):
        """Test health check endpoint"""
        response = await self.make_request('GET', '/health')
        
        if response['status'] == 200:
            data = response['data']
            if isinstance(data, dict) and data.get('status') in ['healthy', 'degraded']:
                services = data.get('services', {})
                self.log_test(
                    "Health Check", 
                    "PASS", 
                    f"Status: {data['status']}, Services: {list(services.keys())}"
                )
            else:
                self.log_test("Health Check", "FAIL", "Invalid health response format", data)
        else:
            self.log_test("Health Check", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_readiness_check(self):
        """Test readiness check endpoint"""
        response = await self.make_request('GET', '/ready')
        
        if response['status'] == 200:
            self.log_test("Readiness Check", "PASS", "Service is ready")
        else:
            self.log_test("Readiness Check", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_media_status(self):
        """Test media service status"""
        response = await self.make_request('GET', '/media/status')
        
        if response['status'] == 200:
            data = response['data']
            cloudinary_status = data.get('cloudinary', {}).get('configured', False)
            self.log_test(
                "Media Service Status", 
                "PASS", 
                f"Cloudinary configured: {cloudinary_status}"
            )
        else:
            self.log_test("Media Service Status", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_authentication_flow(self):
        """Test authentication with mock session"""
        # Since we can't do real OAuth, we'll test with a mock session ID
        mock_session_id = f"test_session_{uuid.uuid4().hex[:12]}"
        
        response = await self.make_request('GET', f'/auth/session?session_id={mock_session_id}')
        
        if response['status'] == 400:
            # Expected - invalid session ID should return 400
            self.log_test("Authentication Flow", "PASS", "Properly rejects invalid session ID")
        else:
            self.log_test("Authentication Flow", "FAIL", f"Unexpected status: {response['status']}", response['data'])
    
    async def test_auth_without_token(self):
        """Test protected endpoints without authentication"""
        endpoints_to_test = [
            '/auth/me',
            '/posts',
            '/posts/feed',
            '/users/me'
        ]
        
        passed = 0
        for endpoint in endpoints_to_test:
            response = await self.make_request('GET', endpoint)
            if response['status'] == 401:
                passed += 1
        
        if passed == len(endpoints_to_test):
            self.log_test("Auth Protection", "PASS", f"All {len(endpoints_to_test)} endpoints properly protected")
        else:
            self.log_test("Auth Protection", "FAIL", f"Only {passed}/{len(endpoints_to_test)} endpoints protected")
    
    async def test_session_validation(self):
        """Test session ID validation"""
        # Test with overly long session ID
        long_session = "x" * 600
        response = await self.make_request('GET', f'/auth/session?session_id={long_session}')
        
        if response['status'] in [400, 422]:
            self.log_test("Session Validation", "PASS", "Rejects overly long session ID")
        else:
            self.log_test("Session Validation", "FAIL", f"Status: {response['status']}", response['data'])
    
    # ============ CORE API ENDPOINTS TESTS ============
    
    async def test_posts_endpoints_without_auth(self):
        """Test posts endpoints behavior without authentication"""
        endpoints = [
            ('GET', '/posts'),
            ('GET', '/posts/feed'),
            ('GET', '/posts/explore'),
            ('POST', '/posts')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Posts Auth Protection", "PASS", "All posts endpoints require authentication")
        else:
            self.log_test("Posts Auth Protection", "FAIL", "Some posts endpoints not protected")
    
    async def test_user_endpoints_without_auth(self):
        """Test user endpoints behavior without authentication"""
        test_user_id = "test_user_123"
        endpoints = [
            ('GET', f'/users/{test_user_id}'),
            ('GET', f'/users/{test_user_id}/stats'),
            ('PUT', '/users/me'),
            ('POST', f'/users/{test_user_id}/follow')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("User Auth Protection", "PASS", "All user endpoints require authentication")
        else:
            self.log_test("User Auth Protection", "FAIL", "Some user endpoints not protected")
    
    async def test_comments_endpoints_without_auth(self):
        """Test comments endpoints behavior without authentication"""
        test_post_id = "test_post_123"
        test_comment_id = "test_comment_123"
        endpoints = [
            ('GET', f'/posts/{test_post_id}/comments'),
            ('POST', f'/posts/{test_post_id}/comments'),
            ('POST', f'/comments/{test_comment_id}/like'),
            ('DELETE', f'/comments/{test_comment_id}')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Comments Auth Protection", "PASS", "All comments endpoints require authentication")
        else:
            self.log_test("Comments Auth Protection", "FAIL", "Some comments endpoints not protected")
    
    async def test_notifications_endpoints_without_auth(self):
        """Test notifications endpoints behavior without authentication"""
        endpoints = [
            ('GET', '/notifications'),
            ('POST', '/notifications/mark-all-read'),
            ('POST', '/notifications/mark-read/test_notif_123')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Notifications Auth Protection", "PASS", "All notifications endpoints require authentication")
        else:
            self.log_test("Notifications Auth Protection", "FAIL", "Some notifications endpoints not protected")
    
    # ============ MEDIA UPLOAD TESTS ============
    
    async def test_file_upload_security(self):
        """Test file upload security without authentication"""
        # Test creating post with media without auth
        response = await self.make_request('POST', '/posts')
        
        if response['status'] == 401:
            self.log_test("File Upload Security", "PASS", "Media upload requires authentication")
        else:
            self.log_test("File Upload Security", "FAIL", f"Status: {response['status']}", response['data'])
    
    # ============ DATABASE OPERATIONS TESTS ============
    
    async def test_pagination_limits(self):
        """Test pagination limits without authentication"""
        # Test with excessive limit parameter
        response = await self.make_request('GET', '/posts?limit=1000&skip=0')
        
        if response['status'] == 401:
            self.log_test("Pagination Limits", "PASS", "Pagination endpoints require authentication")
        else:
            self.log_test("Pagination Limits", "FAIL", f"Status: {response['status']}", response['data'])
    
    # ============ PAYMENT INTEGRATION TESTS ============
    
    async def test_payment_endpoints_security(self):
        """Test payment endpoints security"""
        # Test order creation without auth
        response = await self.make_request('POST', '/orders')
        
        if response['status'] == 401:
            self.log_test("Payment Security", "PASS", "Payment endpoints require authentication")
        else:
            self.log_test("Payment Security", "FAIL", f"Status: {response['status']}", response['data'])
    
    # ============ LIVE STREAMING TESTS ============
    
    async def test_streaming_endpoints_security(self):
        """Test streaming endpoints security"""
        endpoints = [
            ('GET', '/streams/agora-config'),
            ('POST', '/streams/token'),
            ('POST', '/streams/start'),
            ('GET', '/streams/live')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Streaming Security", "PASS", "All streaming endpoints require authentication")
        else:
            self.log_test("Streaming Security", "FAIL", "Some streaming endpoints not protected")
    
    # ============ ERROR HANDLING TESTS ============
    
    async def test_invalid_endpoints(self):
        """Test 404 handling for invalid endpoints"""
        invalid_endpoints = [
            '/nonexistent',
            '/posts/invalid/action',
            '/users/invalid/endpoint',
            '/streams/invalid/method'
        ]
        
        all_404 = True
        for endpoint in invalid_endpoints:
            response = await self.make_request('GET', endpoint)
            if response['status'] != 404:
                all_404 = False
                break
        
        if all_404:
            self.log_test("404 Error Handling", "PASS", "Invalid endpoints return 404")
        else:
            self.log_test("404 Error Handling", "FAIL", "Some invalid endpoints don't return 404")
    
    async def test_malformed_json(self):
        """Test malformed JSON handling"""
        response = await self.make_request(
            'POST', 
            '/posts',
            data='{"invalid": json}',
            headers={'Content-Type': 'application/json'}
        )
        
        if response['status'] in [400, 401, 422]:
            self.log_test("Malformed JSON", "PASS", f"Properly handles malformed JSON (status: {response['status']})")
        else:
            self.log_test("Malformed JSON", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_sql_injection_attempts(self):
        """Test SQL injection prevention"""
        # Test with SQL injection patterns in query parameters
        injection_patterns = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'/*",
            "' UNION SELECT * FROM users --"
        ]
        
        all_safe = True
        for pattern in injection_patterns:
            response = await self.make_request('GET', f'/users/{pattern}')
            # Should return 400 (bad request) or 401 (unauthorized), not 500 (server error)
            if response['status'] == 500:
                all_safe = False
                break
        
        if all_safe:
            self.log_test("SQL Injection Prevention", "PASS", "No server errors from injection attempts")
        else:
            self.log_test("SQL Injection Prevention", "FAIL", "Server error detected from injection attempt")
    
    async def test_xss_prevention(self):
        """Test XSS prevention"""
        # Test with XSS patterns
        xss_patterns = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "';alert('xss');//"
        ]
        
        all_safe = True
        for pattern in xss_patterns:
            response = await self.make_request('GET', f'/users/{pattern}')
            # Should return 400 (bad request) or 401 (unauthorized), not execute script
            if response['status'] == 500:
                all_safe = False
                break
        
        if all_safe:
            self.log_test("XSS Prevention", "PASS", "No server errors from XSS attempts")
        else:
            self.log_test("XSS Prevention", "FAIL", "Server error detected from XSS attempt")
    
    # ============ EDGE CASES TESTS ============
    
    async def test_empty_requests(self):
        """Test empty request handling"""
        response = await self.make_request('POST', '/posts', data='')
        
        if response['status'] in [400, 401, 422]:
            self.log_test("Empty Request Handling", "PASS", f"Properly handles empty requests (status: {response['status']})")
        else:
            self.log_test("Empty Request Handling", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_oversized_requests(self):
        """Test oversized request handling"""
        # Create a large payload
        large_data = {"content": "x" * 100000}  # 100KB content
        
        response = await self.make_request(
            'POST', 
            '/posts',
            json=large_data
        )
        
        if response['status'] in [400, 401, 413, 422]:
            self.log_test("Oversized Request Handling", "PASS", f"Properly handles large requests (status: {response['status']})")
        else:
            self.log_test("Oversized Request Handling", "FAIL", f"Status: {response['status']}", response['data'])
    
    async def test_rate_limiting(self):
        """Test rate limiting behavior"""
        # Make multiple rapid requests
        responses = []
        for i in range(10):
            response = await self.make_request('GET', '/health')
            responses.append(response['status'])
        
        # Check if any rate limiting occurred (429 status)
        rate_limited = any(status == 429 for status in responses)
        
        if rate_limited:
            self.log_test("Rate Limiting", "PASS", "Rate limiting is active")
        else:
            self.log_test("Rate Limiting", "INFO", "No rate limiting detected (may be configured differently)")
    
    async def test_cors_headers(self):
        """Test CORS headers"""
        response = await self.make_request('OPTIONS', '/health')
        
        cors_headers = [
            'access-control-allow-origin',
            'access-control-allow-methods',
            'access-control-allow-headers'
        ]
        
        has_cors = any(header in response['headers'] for header in cors_headers)
        
        if has_cors:
            self.log_test("CORS Headers", "PASS", "CORS headers present")
        else:
            self.log_test("CORS Headers", "WARN", "CORS headers not detected")
    
    async def test_stories_endpoints_security(self):
        """Test stories endpoints security"""
        endpoints = [
            ('GET', '/stories'),
            ('POST', '/stories'),
            ('GET', '/stories/me'),
            ('POST', '/stories/test_story_123/view')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Stories Security", "PASS", "All stories endpoints require authentication")
        else:
            self.log_test("Stories Security", "FAIL", "Some stories endpoints not protected")
    
    async def test_products_endpoints_security(self):
        """Test products endpoints security"""
        endpoints = [
            ('GET', '/products'),
            ('POST', '/products'),
            ('GET', '/products/me'),
            ('PUT', '/products/test_product_123')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Products Security", "PASS", "All products endpoints require authentication")
        else:
            self.log_test("Products Security", "FAIL", "Some products endpoints not protected")
    
    async def test_discount_endpoints_security(self):
        """Test discount endpoints security"""
        endpoints = [
            ('GET', '/discounts'),
            ('POST', '/discounts'),
            ('GET', '/discounts/validate/TEST123'),
            ('DELETE', '/discounts/TEST123')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Discounts Security", "PASS", "All discount endpoints require authentication")
        else:
            self.log_test("Discounts Security", "FAIL", "Some discount endpoints not protected")
    
    async def test_analytics_endpoints_security(self):
        """Test analytics endpoints security"""
        endpoints = [
            ('GET', '/analytics/revenue'),
            ('GET', '/analytics/engagement')
        ]
        
        all_protected = True
        for method, endpoint in endpoints:
            response = await self.make_request(method, endpoint)
            if response['status'] != 401:
                all_protected = False
                break
        
        if all_protected:
            self.log_test("Analytics Security", "PASS", "All analytics endpoints require authentication")
        else:
            self.log_test("Analytics Security", "FAIL", "Some analytics endpoints not protected")
    
    # ============ MAIN TEST RUNNER ============
    
    async def run_all_tests(self):
        """Run all test categories"""
        print("🔐 AUTHENTICATION & SECURITY TESTS")
        print("-" * 40)
        await self.test_health_check()
        await self.test_readiness_check()
        await self.test_media_status()
        await self.test_authentication_flow()
        await self.test_auth_without_token()
        await self.test_session_validation()
        
        print("\n📡 CORE API ENDPOINTS TESTS")
        print("-" * 40)
        await self.test_posts_endpoints_without_auth()
        await self.test_user_endpoints_without_auth()
        await self.test_comments_endpoints_without_auth()
        await self.test_notifications_endpoints_without_auth()
        
        print("\n📁 MEDIA UPLOAD TESTS")
        print("-" * 40)
        await self.test_file_upload_security()
        
        print("\n🗄️ DATABASE OPERATIONS TESTS")
        print("-" * 40)
        await self.test_pagination_limits()
        
        print("\n💳 PAYMENT INTEGRATION TESTS")
        print("-" * 40)
        await self.test_payment_endpoints_security()
        
        print("\n📺 LIVE STREAMING TESTS")
        print("-" * 40)
        await self.test_streaming_endpoints_security()
        
        print("\n📚 ADDITIONAL FEATURE TESTS")
        print("-" * 40)
        await self.test_stories_endpoints_security()
        await self.test_products_endpoints_security()
        await self.test_discount_endpoints_security()
        await self.test_analytics_endpoints_security()
        
        print("\n⚠️ ERROR HANDLING TESTS")
        print("-" * 40)
        await self.test_invalid_endpoints()
        await self.test_malformed_json()
        await self.test_sql_injection_attempts()
        await self.test_xss_prevention()
        
        print("\n🔍 EDGE CASES TESTS")
        print("-" * 40)
        await self.test_empty_requests()
        await self.test_oversized_requests()
        await self.test_rate_limiting()
        await self.test_cors_headers()
    
    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.test_results)
        passed = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed = len([r for r in self.test_results if r['status'] == 'FAIL'])
        warnings = len([r for r in self.test_results if r['status'] in ['WARN', 'INFO']])
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Warnings/Info: {warnings}")
        print(f"Success Rate: {(passed/total_tests)*100:.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  • {result['test']}: {result['details']}")
        
        if warnings > 0:
            print("\n⚠️ WARNINGS/INFO:")
            for result in self.test_results:
                if result['status'] in ['WARN', 'INFO']:
                    print(f"  • {result['test']}: {result['details']}")
        
        return {
            'total': total_tests,
            'passed': passed,
            'failed': failed,
            'warnings': warnings,
            'success_rate': (passed/total_tests)*100
        }

async def main():
    """Main test runner"""
    tester = GroverBackendTester()
    
    try:
        await tester.setup()
        await tester.run_all_tests()
        summary = tester.generate_summary()
        
        # Save detailed results
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump({
                'summary': summary,
                'detailed_results': tester.test_results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
        
    except Exception as e:
        print(f"❌ Test runner error: {e}")
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())