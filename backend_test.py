#!/usr/bin/env python3
"""
CargoPaths Backend API Testing Suite
Tests all backend endpoints with proper authentication flow
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://cargo-paths.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@cargopaths.com"
ADMIN_PASSWORD = "admin123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method, endpoint, data=None, headers=None, use_auth=True):
        """Make HTTP request with optional authentication"""
        url = f"{API_BASE}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        
        if use_auth and self.access_token:
            req_headers["Authorization"] = f"Bearer {self.access_token}"
            
        if headers:
            req_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=req_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
            
    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        
        # Test root endpoint
        response = self.make_request("GET", "/", use_auth=False)
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Root endpoint", True, f"Message: {data.get('message')}")
        else:
            self.log_test("Root endpoint", False, f"Status: {response.status_code if response else 'No response'}")
            
        # Test health endpoint
        response = self.make_request("GET", "/health", use_auth=False)
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Health check", True, f"Status: {data.get('status')}")
        else:
            self.log_test("Health check", False, f"Status: {response.status_code if response else 'No response'}")
            
    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test login with admin credentials
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        if response and response.status_code == 200:
            data = response.json()
            self.access_token = data.get("access_token")
            self.user_id = data.get("id")
            self.log_test("Admin login", True, f"User ID: {self.user_id}, Token received: {bool(self.access_token)}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Admin login", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            return False
            
        # Test get current user
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Get current user", True, f"Email: {data.get('email')}, Tier: {data.get('subscription_tier')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Get current user", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
        # Test logout
        response = self.make_request("POST", "/auth/logout")
        if response and response.status_code == 200:
            self.log_test("Logout", True, "Successfully logged out")
        else:
            self.log_test("Logout", False, f"Status: {response.status_code if response else 'No response'}")
            
        # Re-login for subsequent tests
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        if response and response.status_code == 200:
            data = response.json()
            self.access_token = data.get("access_token")
            
        return True
        
    def test_user_registration(self):
        """Test user registration"""
        print("\n=== USER REGISTRATION TEST ===")
        
        # Test registration with new user
        test_user_data = {
            "email": f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
            "password": "testpass123",
            "name": "Test User"
        }
        
        response = self.make_request("POST", "/auth/register", test_user_data, use_auth=False)
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("User registration", True, f"New user ID: {data.get('id')}, Email: {data.get('email')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("User registration", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
    def test_vehicles(self):
        """Test vehicle CRUD operations"""
        print("\n=== VEHICLE TESTS ===")
        
        if not self.access_token:
            self.log_test("Vehicle tests", False, "No authentication token available")
            return
            
        # Test get vehicles (initially empty)
        response = self.make_request("GET", "/vehicles")
        if response and response.status_code == 200:
            vehicles = response.json()
            self.log_test("Get vehicles", True, f"Found {len(vehicles)} vehicles")
        else:
            self.log_test("Get vehicles", False, f"Status: {response.status_code if response else 'No response'}")
            
        # Test create vehicle
        vehicle_data = {
            "name": "Work Lorry",
            "vehicle_type": "lorry",
            "height_meters": 4.0,
            "width_meters": 2.5,
            "weight_kg": 18000,
            "license_plate": "TEST123"
        }
        
        response = self.make_request("POST", "/vehicles", vehicle_data)
        vehicle_id = None
        if response and response.status_code == 200:
            data = response.json()
            vehicle_id = data.get("id")
            self.log_test("Create vehicle", True, f"Vehicle ID: {vehicle_id}, Name: {data.get('name')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Create vehicle", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
        # Test get active vehicle
        response = self.make_request("GET", "/vehicles/active")
        if response and response.status_code == 200:
            data = response.json()
            if data:
                self.log_test("Get active vehicle", True, f"Active vehicle: {data.get('name')}")
            else:
                self.log_test("Get active vehicle", True, "No active vehicle (null response)")
        else:
            self.log_test("Get active vehicle", False, f"Status: {response.status_code if response else 'No response'}")
            
        # Test activate vehicle (if we have a vehicle ID)
        if vehicle_id:
            response = self.make_request("PUT", f"/vehicles/{vehicle_id}/activate")
            if response and response.status_code == 200:
                self.log_test("Activate vehicle", True, "Vehicle activated successfully")
            else:
                error_msg = response.json().get("detail") if response else "No response"
                self.log_test("Activate vehicle", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
                
        # Test create second vehicle to test limits
        vehicle_data2 = {
            "name": "Delivery Van",
            "vehicle_type": "van",
            "height_meters": 2.8,
            "width_meters": 2.0,
            "weight_kg": 3500
        }
        
        response = self.make_request("POST", "/vehicles", vehicle_data2)
        vehicle_id2 = None
        if response and response.status_code == 200:
            data = response.json()
            vehicle_id2 = data.get("id")
            self.log_test("Create second vehicle", True, f"Vehicle ID: {vehicle_id2}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Create second vehicle", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
        # Test delete vehicle (clean up)
        if vehicle_id2:
            response = self.make_request("DELETE", f"/vehicles/{vehicle_id2}")
            if response and response.status_code == 200:
                self.log_test("Delete vehicle", True, "Vehicle deleted successfully")
            else:
                error_msg = response.json().get("detail") if response else "No response"
                self.log_test("Delete vehicle", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
                
    def test_alerts(self):
        """Test road alerts functionality"""
        print("\n=== ROAD ALERTS TESTS ===")
        
        # Test get alerts (should have seeded data)
        response = self.make_request("GET", "/alerts", use_auth=False)
        if response and response.status_code == 200:
            alerts = response.json()
            self.log_test("Get alerts", True, f"Found {len(alerts)} alerts")
        else:
            self.log_test("Get alerts", False, f"Status: {response.status_code if response else 'No response'}")
            
        if not self.access_token:
            self.log_test("Alert creation tests", False, "No authentication token available")
            return
            
        # Test create alert
        alert_data = {
            "alert_type": "speed_camera",
            "latitude": 51.5,
            "longitude": -0.12,
            "description": "Test speed camera",
            "speed_limit": 30
        }
        
        response = self.make_request("POST", "/alerts", alert_data)
        alert_id = None
        if response and response.status_code == 200:
            data = response.json()
            alert_id = data.get("id")
            self.log_test("Create alert", True, f"Alert ID: {alert_id}, Type: {data.get('alert_type')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Create alert", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
        # Test upvote alert
        if alert_id:
            response = self.make_request("POST", f"/alerts/{alert_id}/upvote")
            if response and response.status_code == 200:
                self.log_test("Upvote alert", True, "Alert upvoted successfully")
            else:
                error_msg = response.json().get("detail") if response else "No response"
                self.log_test("Upvote alert", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
        else:
            # Try upvoting a seeded alert
            response = self.make_request("GET", "/alerts", use_auth=False)
            if response and response.status_code == 200:
                alerts = response.json()
                if alerts:
                    first_alert_id = alerts[0]["id"]
                    response = self.make_request("POST", f"/alerts/{first_alert_id}/upvote")
                    if response and response.status_code == 200:
                        self.log_test("Upvote existing alert", True, "Existing alert upvoted successfully")
                    else:
                        error_msg = response.json().get("detail") if response else "No response"
                        self.log_test("Upvote existing alert", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
                        
    def test_restrictions(self):
        """Test road restrictions functionality"""
        print("\n=== ROAD RESTRICTIONS TESTS ===")
        
        # Test get restrictions (should have seeded data)
        response = self.make_request("GET", "/restrictions", use_auth=False)
        if response and response.status_code == 200:
            restrictions = response.json()
            self.log_test("Get restrictions", True, f"Found {len(restrictions)} restrictions")
        else:
            self.log_test("Get restrictions", False, f"Status: {response.status_code if response else 'No response'}")
            
        if not self.access_token:
            self.log_test("Restriction creation tests", False, "No authentication token available")
            return
            
        # Test create restriction
        restriction_data = {
            "restriction_type": "height",
            "latitude": 51.52,
            "longitude": -0.13,
            "limit_value": 3.5,
            "description": "Test height restriction"
        }
        
        response = self.make_request("POST", "/restrictions", restriction_data)
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Create restriction", True, f"Restriction ID: {data.get('id')}, Type: {data.get('restriction_type')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Create restriction", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
    def test_subscription(self):
        """Test subscription functionality"""
        print("\n=== SUBSCRIPTION TESTS ===")
        
        if not self.access_token:
            self.log_test("Subscription tests", False, "No authentication token available")
            return
            
        # Test get subscription
        response = self.make_request("GET", "/subscription")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Get subscription", True, f"Tier: {data.get('tier')}, Vehicle limit: {data.get('vehicle_limit')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Get subscription", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
        # Test upgrade subscription (MOCKED)
        upgrade_data = {"tier": "basic"}
        response = self.make_request("POST", "/subscription/upgrade", upgrade_data)
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Upgrade subscription", True, f"Message: {data.get('message')}")
        else:
            error_msg = response.json().get("detail") if response else "No response"
            self.log_test("Upgrade subscription", False, f"Status: {response.status_code if response else 'No response'}, Error: {error_msg}")
            
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting CargoPaths Backend API Tests")
        print(f"Base URL: {BASE_URL}")
        print(f"API Base: {API_BASE}")
        
        # Run test suites
        self.test_health_check()
        self.test_authentication()
        self.test_user_registration()
        self.test_vehicles()
        self.test_alerts()
        self.test_restrictions()
        self.test_subscription()
        
        # Summary
        print("\n" + "="*50)
        print("TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
            
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)