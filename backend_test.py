#!/usr/bin/env python3
"""
Backend Testing Script for Grover Marketplace and Discount Code Endpoints
Tests the new marketplace and discount code functionality
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os
import sys

# Configuration
BACKEND_URL = "https://social-maker-4.preview.emergentagent.com/api"
TEST_USER_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
TEST_USER_NAME = "Test User Marketplace"

class BackendTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.created_products = []
        self.created_discounts = []
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def create_test_user_and_auth(self):
        """Get a valid session token from existing database sessions"""
        self.log("Getting valid session token from database...")
        
        try:
            # Import MongoDB client
            from motor.motor_asyncio import AsyncIOMotorClient
            import asyncio
            
            async def get_valid_session():
                client = AsyncIOMotorClient('mongodb://localhost:27017')
                db = client['test_database']
                
                # Find a valid session that hasn't expired
                session = await db.user_sessions.find_one(
                    {'expires_at': {'$gt': datetime.now()}},
                    {'_id': 0}
                )
                
                client.close()
                return session
            
            # Run async function
            session = asyncio.run(get_valid_session())
            
            if session:
                self.session_token = session['session_token']
                self.user_id = session['user_id']
                self.log(f"✅ Using existing session for user: {self.user_id}")
                return True
            else:
                self.log("❌ No valid sessions found in database", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Session retrieval error: {str(e)}", "ERROR")
            return False
    
    def get_headers(self):
        """Get authentication headers"""
        return {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
    
    def test_enhanced_product_creation(self):
        """Test enhanced product creation with new fields"""
        self.log("Testing enhanced product creation...")
        
        test_cases = [
            {
                "name": "Digital Course Bundle",
                "description": "Complete web development course with bonus materials",
                "price": 99.99,
                "product_type": "digital",
                "digital_file_url": "https://example.com/course-download",
                "is_bundle": True,
                "bundle_items": json.dumps(["item1", "item2", "item3"])
            },
            {
                "name": "1-Hour Consultation Service",
                "description": "Personal consultation session with expert",
                "price": 150.00,
                "product_type": "service",
                "service_duration": 60,
                "is_bundle": False
            },
            {
                "name": "Physical Product",
                "description": "Traditional physical merchandise",
                "price": 29.99,
                "product_type": "physical",
                "is_bundle": False
            }
        ]
        
        success_count = 0
        
        for i, product_data in enumerate(test_cases, 1):
            try:
                response = requests.post(
                    f"{BACKEND_URL}/products",
                    data=product_data,
                    headers={"Authorization": f"Bearer {self.session_token}"},
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    product_id = result.get("product_id")
                    self.created_products.append(product_id)
                    self.log(f"✅ Product {i} created: {product_id} ({product_data['product_type']})")
                    success_count += 1
                else:
                    self.log(f"❌ Product {i} creation failed: {response.status_code} - {response.text}", "ERROR")
                    
            except Exception as e:
                self.log(f"❌ Product {i} creation error: {str(e)}", "ERROR")
        
        return success_count == len(test_cases)
    
    def test_get_products_with_types(self):
        """Test getting products and verify product_type is returned"""
        self.log("Testing product retrieval with product types...")
        
        try:
            response = requests.get(
                f"{BACKEND_URL}/products",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                products = response.json()
                
                if not products:
                    self.log("❌ No products found", "ERROR")
                    return False
                
                # Check if our newly created products have product_type field
                types_found = set()
                new_products_found = 0
                
                for product in products:
                    # Check if this is one of our newly created products
                    if product.get("product_id") in self.created_products:
                        new_products_found += 1
                        if "product_type" in product:
                            types_found.add(product["product_type"])
                            self.log(f"✅ New product {product['product_id']} has type: {product['product_type']}")
                        else:
                            self.log(f"❌ New product {product.get('product_id', 'unknown')} missing product_type field", "ERROR")
                            return False
                
                if new_products_found == len(self.created_products):
                    self.log(f"✅ All {new_products_found} newly created products have product_type field with types: {list(types_found)}")
                    return True
                else:
                    self.log(f"❌ Expected {len(self.created_products)} new products, found {new_products_found}", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get products: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get products error: {str(e)}", "ERROR")
            return False
    
    def test_discount_code_creation(self):
        """Test discount code creation"""
        self.log("Testing discount code creation...")
        
        # Generate unique codes to avoid conflicts
        unique_suffix = uuid.uuid4().hex[:6].upper()
        
        test_codes = [
            {
                "code": f"SAVE20_{unique_suffix}",
                "percent": 20,
                "expiry": None
            },
            {
                "code": f"FLASH50_{unique_suffix}",
                "percent": 50,
                "expiry": (datetime.now() + timedelta(days=30)).isoformat()
            },
            {
                "code": f"WELCOME10_{unique_suffix}",
                "percent": 10,
                "expiry": None
            }
        ]
        
        success_count = 0
        
        for i, code_data in enumerate(test_codes, 1):
            try:
                response = requests.post(
                    f"{BACKEND_URL}/discounts",
                    json=code_data,
                    headers=self.get_headers(),
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    code = result.get("code")
                    self.created_discounts.append(code)
                    self.log(f"✅ Discount code {i} created: {code} ({code_data['percent']}%)")
                    success_count += 1
                else:
                    self.log(f"❌ Discount code {i} creation failed: {response.status_code} - {response.text}", "ERROR")
                    
            except Exception as e:
                self.log(f"❌ Discount code {i} creation error: {str(e)}", "ERROR")
        
        return success_count == len(test_codes)
    
    def test_get_user_discounts(self):
        """Test getting user's discount codes"""
        self.log("Testing user discount codes retrieval...")
        
        try:
            response = requests.get(
                f"{BACKEND_URL}/discounts",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                discounts = response.json()
                
                if len(discounts) >= len(self.created_discounts):
                    self.log(f"✅ Retrieved {len(discounts)} discount codes")
                    
                    # Verify our created codes are in the list
                    found_codes = [d["code"] for d in discounts]
                    for code in self.created_discounts:
                        if code in found_codes:
                            self.log(f"✅ Found created code: {code}")
                        else:
                            self.log(f"❌ Missing created code: {code}", "ERROR")
                            return False
                    
                    return True
                else:
                    self.log(f"❌ Expected at least {len(self.created_discounts)} codes, got {len(discounts)}", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get discounts: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get discounts error: {str(e)}", "ERROR")
            return False
    
    def test_discount_validation(self):
        """Test discount code validation"""
        self.log("Testing discount code validation...")
        
        if not self.created_discounts:
            self.log("❌ No discount codes to validate", "ERROR")
            return False
        
        success_count = 0
        
        # Test valid codes
        for code in self.created_discounts:
            try:
                response = requests.get(
                    f"{BACKEND_URL}/discounts/validate/{code}",
                    headers=self.get_headers(),
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("valid") and result.get("code") == code:
                        self.log(f"✅ Code validation successful: {code} ({result.get('percent')}%)")
                        success_count += 1
                    else:
                        self.log(f"❌ Code validation returned invalid: {code}", "ERROR")
                else:
                    self.log(f"❌ Code validation failed: {code} - {response.status_code} - {response.text}", "ERROR")
                    
            except Exception as e:
                self.log(f"❌ Code validation error for {code}: {str(e)}", "ERROR")
        
        # Test invalid code
        try:
            invalid_code = "INVALID123"
            response = requests.get(
                f"{BACKEND_URL}/discounts/validate/{invalid_code}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 404:
                self.log(f"✅ Invalid code correctly rejected: {invalid_code}")
                success_count += 1
            else:
                self.log(f"❌ Invalid code should return 404, got {response.status_code}", "ERROR")
                
        except Exception as e:
            self.log(f"❌ Invalid code test error: {str(e)}", "ERROR")
        
        return success_count == len(self.created_discounts) + 1
    
    def test_discount_deletion(self):
        """Test discount code deletion"""
        self.log("Testing discount code deletion...")
        
        if not self.created_discounts:
            self.log("❌ No discount codes to delete", "ERROR")
            return False
        
        # Delete the first code
        code_to_delete = self.created_discounts[0]
        
        try:
            response = requests.delete(
                f"{BACKEND_URL}/discounts/{code_to_delete}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                self.log(f"✅ Discount code deleted: {code_to_delete}")
                
                # Try to validate the deleted code (should fail)
                validate_response = requests.get(
                    f"{BACKEND_URL}/discounts/validate/{code_to_delete}",
                    headers=self.get_headers(),
                    timeout=10
                )
                
                if validate_response.status_code == 404:
                    self.log(f"✅ Deleted code correctly invalid: {code_to_delete}")
                    return True
                else:
                    self.log(f"❌ Deleted code still validates: {code_to_delete}", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to delete code: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Code deletion error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all marketplace and discount code tests"""
        self.log("🚀 Starting Marketplace and Discount Code Backend Tests")
        self.log("=" * 60)
        
        tests = [
            ("User Authentication", self.create_test_user_and_auth),
            ("Enhanced Product Creation", self.test_enhanced_product_creation),
            ("Product Retrieval with Types", self.test_get_products_with_types),
            ("Discount Code Creation", self.test_discount_code_creation),
            ("User Discount Retrieval", self.test_get_user_discounts),
            ("Discount Code Validation", self.test_discount_validation),
            ("Discount Code Deletion", self.test_discount_deletion),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                self.log(f"❌ {test_name}: ERROR - {str(e)}")
        
        self.log("\n" + "=" * 60)
        self.log(f"🏁 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL MARKETPLACE AND DISCOUNT TESTS PASSED!")
            return True
        else:
            self.log(f"⚠️  {total - passed} tests failed")
            return False

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ MARKETPLACE AND DISCOUNT CODE BACKEND TESTING COMPLETE - ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ MARKETPLACE AND DISCOUNT CODE BACKEND TESTING COMPLETE - SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()