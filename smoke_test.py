#!/usr/bin/env python3
"""
Grover Backend Smoke Tests - Focused on Core Availability
Tests after Expo SDK 54 dependency updates
"""

import requests
import json
import time
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://build-rescue-8.preview.emergentagent.com/api"

def test_core_availability():
    """Test core backend availability and key endpoints"""
    print("🚀 Grover Backend Smoke Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health Check
    print("1. Testing Health Check...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            services = data.get("services", {})
            mongodb_status = services.get("mongodb", {}).get("status")
            print(f"   ✅ Health Check: {data.get('status')} (MongoDB: {mongodb_status})")
            results.append(("Health Check", True, f"Status: {data.get('status')}"))
        else:
            print(f"   ❌ Health Check Failed: {response.status_code}")
            results.append(("Health Check", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ Health Check Error: {e}")
        results.append(("Health Check", False, str(e)))
    
    # Test 2: Readiness Check
    print("2. Testing Readiness Check...")
    try:
        response = requests.get(f"{BACKEND_URL}/ready", timeout=10)
        if response.status_code == 200:
            print("   ✅ Readiness Check: Service Ready")
            results.append(("Readiness Check", True, "Service Ready"))
        else:
            print(f"   ❌ Readiness Check Failed: {response.status_code}")
            results.append(("Readiness Check", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ Readiness Check Error: {e}")
        results.append(("Readiness Check", False, str(e)))
    
    # Test 3: Auth Session Endpoint (should reject invalid session)
    print("3. Testing Auth Session Endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/auth/session?session_id=invalid_test_session", timeout=10)
        if response.status_code in [400, 422]:
            print("   ✅ Auth Session: Correctly rejects invalid session")
            results.append(("Auth Session", True, "Rejects invalid session"))
        else:
            print(f"   ❌ Auth Session: Unexpected status {response.status_code}")
            results.append(("Auth Session", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ Auth Session Error: {e}")
        results.append(("Auth Session", False, str(e)))
    
    # Test 4: Protected Endpoints (should require auth)
    print("4. Testing Protected Endpoints...")
    protected_endpoints = [
        ("/posts", "Posts"),
        ("/posts/feed", "Posts Feed"),
        ("/notifications", "Notifications"),
        ("/auth/me", "Auth Me")
    ]
    
    protected_count = 0
    for endpoint, name in protected_endpoints:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}", timeout=10)
            if response.status_code == 401:
                protected_count += 1
                print(f"   ✅ {name}: Properly protected")
            else:
                print(f"   ❌ {name}: Not protected (status: {response.status_code})")
        except Exception as e:
            print(f"   ❌ {name}: Error - {e}")
    
    if protected_count == len(protected_endpoints):
        results.append(("Protected Endpoints", True, f"All {len(protected_endpoints)} endpoints protected"))
    else:
        results.append(("Protected Endpoints", False, f"Only {protected_count}/{len(protected_endpoints)} protected"))
    
    # Test 5: Agora Config (should work without auth)
    print("5. Testing Agora Config...")
    try:
        response = requests.get(f"{BACKEND_URL}/streams/agora-config", timeout=10)
        if response.status_code == 200:
            data = response.json()
            app_id = data.get("app_id")
            print(f"   ✅ Agora Config: Working (App ID: {app_id})")
            results.append(("Agora Config", True, f"App ID: {app_id}"))
        else:
            print(f"   ❌ Agora Config Failed: {response.status_code}")
            results.append(("Agora Config", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ Agora Config Error: {e}")
        results.append(("Agora Config", False, str(e)))
    
    # Test 6: Media Status
    print("6. Testing Media Status...")
    try:
        response = requests.get(f"{BACKEND_URL}/media/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            cloudinary_configured = data.get("cloudinary", {}).get("configured", False)
            print(f"   ✅ Media Status: Working (Cloudinary: {cloudinary_configured})")
            results.append(("Media Status", True, f"Cloudinary: {cloudinary_configured}"))
        else:
            print(f"   ❌ Media Status Failed: {response.status_code}")
            results.append(("Media Status", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ Media Status Error: {e}")
        results.append(("Media Status", False, str(e)))
    
    # Test 7: 404 Handling
    print("7. Testing 404 Handling...")
    try:
        response = requests.get(f"{BACKEND_URL}/nonexistent-endpoint", timeout=10)
        if response.status_code == 404:
            print("   ✅ 404 Handling: Working correctly")
            results.append(("404 Handling", True, "Returns 404 for invalid endpoints"))
        else:
            print(f"   ❌ 404 Handling: Unexpected status {response.status_code}")
            results.append(("404 Handling", False, f"HTTP {response.status_code}"))
    except Exception as e:
        print(f"   ❌ 404 Handling Error: {e}")
        results.append(("404 Handling", False, str(e)))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SMOKE TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = len([r for r in results if r[1]])
    failed_tests = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if failed_tests > 0:
        print(f"\n❌ FAILED TESTS:")
        for test_name, success, details in results:
            if not success:
                print(f"   - {test_name}: {details}")
    
    print(f"\n🔍 KEY FINDINGS:")
    
    # Check critical services
    health_passed = any(r[0] == "Health Check" and r[1] for r in results)
    ready_passed = any(r[0] == "Readiness Check" and r[1] for r in results)
    auth_passed = any(r[0] == "Protected Endpoints" and r[1] for r in results)
    
    if health_passed and ready_passed:
        print("   ✅ Backend server is healthy and ready")
    else:
        print("   ❌ Backend server has health/readiness issues")
    
    if auth_passed:
        print("   ✅ Authentication protection is working")
    else:
        print("   ❌ Authentication protection has issues")
    
    # Overall assessment
    if failed_tests == 0:
        print(f"\n🎉 ALL SMOKE TESTS PASSED")
        print("   No regressions detected after Expo SDK 54 dependency updates")
        print("   Backend is fully operational")
    elif failed_tests <= 2:
        print(f"\n⚠️  MINOR ISSUES DETECTED")
        print(f"   {failed_tests} tests failed, but core functionality appears intact")
        print("   Backend is mostly operational")
    else:
        print(f"\n🚨 SIGNIFICANT ISSUES DETECTED")
        print(f"   {failed_tests} tests failed - investigation needed")
        print("   Backend may have regressions")
    
    return results

if __name__ == "__main__":
    test_core_availability()