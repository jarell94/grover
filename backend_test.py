#!/usr/bin/env python3
"""
Backend Testing Suite for Grover Live Streaming API
Tests all live streaming endpoints as specified in the review request.
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://creator-hub-323.preview.emergentagent.com/api"
TEST_USER_EMAIL = "streamer@grover.test"
TEST_USER_NAME = "Live Streamer"
TEST_VIEWER_EMAIL = "viewer@grover.test"
TEST_VIEWER_NAME = "Stream Viewer"

class LiveStreamingTester:
    def __init__(self):
        self.session = None
        self.streamer_token = None
        self.viewer_token = None
        self.test_stream_id = None
        self.test_results = []
        
    async def setup_session(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
            
    async def get_valid_session_token(self) -> Optional[str]:
        """Get a valid session token from the database"""
        try:
            import asyncio
            from motor.motor_asyncio import AsyncIOMotorClient
            from datetime import datetime, timezone
            
            client = AsyncIOMotorClient('mongodb://localhost:27017')
            db = client['test_database']
            
            # Find a valid session that hasn't expired
            session = await db.user_sessions.find_one(
                {"expires_at": {"$gt": datetime.now(timezone.utc)}},
                {"_id": 0}
            )
            
            client.close()
            
            if session:
                self.log_test("Get valid session token", True, f"Using session for user: {session['user_id']}")
                return session['session_token']
            else:
                self.log_test("Get valid session token", False, "No valid sessions found")
                return None
                
        except Exception as e:
            self.log_test("Get valid session token", False, str(e))
            return None
            
    async def test_agora_config(self) -> bool:
        """Test GET /api/streams/agora-config"""
        try:
            headers = {"Authorization": f"Bearer {self.streamer_token}"} if self.streamer_token else {}
            async with self.session.get(f"{BACKEND_URL}/streams/agora-config", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if "app_id" in data:
                        self.log_test("GET /api/streams/agora-config", True, f"App ID: {data['app_id']}")
                        return True
                    else:
                        self.log_test("GET /api/streams/agora-config", False, "Missing app_id in response")
                        return False
                else:
                    text = await response.text()
                    self.log_test("GET /api/streams/agora-config", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("GET /api/streams/agora-config", False, str(e))
            return False
            
    async def test_token_generation(self) -> bool:
        """Test POST /api/streams/token"""
        try:
            headers = {"Authorization": f"Bearer {self.streamer_token}"} if self.streamer_token else {}
            data = aiohttp.FormData()
            data.add_field("channel_name", "test_channel_123")
            data.add_field("role", "1")  # Publisher role
            
            async with self.session.post(f"{BACKEND_URL}/streams/token", data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "token" in result and "channel_name" in result:
                        self.log_test("POST /api/streams/token", True, f"Token generated for channel: {result['channel_name']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/token", False, "Missing token or channel_name in response")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/token", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/token", False, str(e))
            return False
            
    async def test_start_stream(self) -> bool:
        """Test POST /api/streams/start"""
        try:
            headers = {"Authorization": f"Bearer {self.streamer_token}"} if self.streamer_token else {}
            data = aiohttp.FormData()
            data.add_field("title", "Test Live Stream")
            data.add_field("description", "This is a test live stream for backend testing")
            data.add_field("enable_super_chat", "true")
            data.add_field("enable_shopping", "false")
            data.add_field("camera_facing", "front")
            
            async with self.session.post(f"{BACKEND_URL}/streams/start", data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "stream_id" in result:
                        self.test_stream_id = result["stream_id"]
                        self.log_test("POST /api/streams/start", True, f"Stream started with ID: {self.test_stream_id}")
                        return True
                    else:
                        self.log_test("POST /api/streams/start", False, "Missing stream_id in response")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/start", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/start", False, str(e))
            return False
            
    async def test_get_live_streams(self) -> bool:
        """Test GET /api/streams/live"""
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.get(f"{BACKEND_URL}/streams/live", headers=headers) as response:
                if response.status == 200:
                    streams = await response.json()
                    if isinstance(streams, list):
                        self.log_test("GET /api/streams/live", True, f"Found {len(streams)} live streams")
                        return True
                    else:
                        self.log_test("GET /api/streams/live", False, "Response is not a list")
                        return False
                else:
                    text = await response.text()
                    self.log_test("GET /api/streams/live", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("GET /api/streams/live", False, str(e))
            return False
            
    async def test_get_stream_details(self) -> bool:
        """Test GET /api/streams/{stream_id}"""
        if not self.test_stream_id:
            self.log_test("GET /api/streams/{stream_id}", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.get(f"{BACKEND_URL}/streams/{self.test_stream_id}", headers=headers) as response:
                if response.status == 200:
                    stream = await response.json()
                    if "stream_id" in stream and "title" in stream:
                        self.log_test("GET /api/streams/{stream_id}", True, f"Stream details: {stream['title']}")
                        return True
                    else:
                        self.log_test("GET /api/streams/{stream_id}", False, "Missing stream_id or title in response")
                        return False
                else:
                    text = await response.text()
                    self.log_test("GET /api/streams/{stream_id}", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("GET /api/streams/{stream_id}", False, str(e))
            return False
            
    async def test_get_join_info(self) -> bool:
        """Test GET /api/streams/{stream_id}/join-info"""
        if not self.test_stream_id:
            self.log_test("GET /api/streams/{stream_id}/join-info", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.get(f"{BACKEND_URL}/streams/{self.test_stream_id}/join-info", headers=headers) as response:
                if response.status == 200:
                    join_info = await response.json()
                    if "viewer_token" in join_info and "channel_name" in join_info:
                        self.log_test("GET /api/streams/{stream_id}/join-info", True, f"Join info with channel: {join_info['channel_name']}")
                        return True
                    else:
                        self.log_test("GET /api/streams/{stream_id}/join-info", False, "Missing viewer_token or channel_name")
                        return False
                else:
                    text = await response.text()
                    self.log_test("GET /api/streams/{stream_id}/join-info", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("GET /api/streams/{stream_id}/join-info", False, str(e))
            return False
            
    async def test_join_stream(self) -> bool:
        """Test POST /api/streams/{stream_id}/join"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/join", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/join", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result and "viewers_count" in result:
                        self.log_test("POST /api/streams/{stream_id}/join", True, f"Joined stream, viewers: {result['viewers_count']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/join", False, "Missing message or viewers_count")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/join", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/join", False, str(e))
            return False
            
    async def test_leave_stream(self) -> bool:
        """Test POST /api/streams/{stream_id}/leave"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/leave", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/leave", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result and "viewers_count" in result:
                        self.log_test("POST /api/streams/{stream_id}/leave", True, f"Left stream, viewers: {result['viewers_count']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/leave", False, "Missing message or viewers_count")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/leave", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/leave", False, str(e))
            return False
            
    async def test_send_chat(self) -> bool:
        """Test POST /api/streams/{stream_id}/chat"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/chat", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            data = aiohttp.FormData()
            data.add_field("text", "Hello from the test suite! This is a test chat message.")
            
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/chat", data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result and "message_id" in result:
                        self.log_test("POST /api/streams/{stream_id}/chat", True, f"Chat sent with ID: {result['message_id']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/chat", False, "Missing message or message_id")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/chat", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/chat", False, str(e))
            return False
            
    async def test_send_like(self) -> bool:
        """Test POST /api/streams/{stream_id}/like"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/like", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/like", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result and "likes_count" in result:
                        self.log_test("POST /api/streams/{stream_id}/like", True, f"Like sent, total likes: {result['likes_count']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/like", False, "Missing message or likes_count")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/like", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/like", False, str(e))
            return False
            
    async def test_send_gift(self) -> bool:
        """Test POST /api/streams/{stream_id}/gift"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/gift", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            data = aiohttp.FormData()
            data.add_field("gift_id", "heart")  # Test with heart gift
            
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/gift", data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result and "gift" in result:
                        self.log_test("POST /api/streams/{stream_id}/gift", True, f"Gift sent: {result['gift']['name']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/gift", False, "Missing message or gift data")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/gift", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/gift", False, str(e))
            return False
            
    async def test_send_superchat(self) -> bool:
        """Test POST /api/streams/{stream_id}/superchat"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/superchat", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.viewer_token}"} if self.viewer_token else {}
            data = aiohttp.FormData()
            data.add_field("amount", "5.00")
            data.add_field("message", "Great stream! Keep up the awesome work!")
            
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/superchat", data=data, headers=headers) as response:
                response_text = await response.text()
                if response.status == 200:
                    try:
                        result = await response.json()
                        if "message" in result and ("superchat_id" in result or "super_chat_id" in result):
                            superchat_id = result.get("superchat_id") or result.get("super_chat_id")
                            self.log_test("POST /api/streams/{stream_id}/superchat", True, f"Superchat sent with ID: {superchat_id}")
                            return True
                        else:
                            self.log_test("POST /api/streams/{stream_id}/superchat", False, f"Missing superchat_id in response: {result}")
                            return False
                    except:
                        # Response might not be JSON
                        self.log_test("POST /api/streams/{stream_id}/superchat", False, f"Non-JSON response: {response_text}")
                        return False
                else:
                    self.log_test("POST /api/streams/{stream_id}/superchat", False, f"Status {response.status}: {response_text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/superchat", False, str(e))
            return False
            
    async def test_end_stream(self) -> bool:
        """Test POST /api/streams/{stream_id}/end"""
        if not self.test_stream_id:
            self.log_test("POST /api/streams/{stream_id}/end", False, "No test stream ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.streamer_token}"} if self.streamer_token else {}
            async with self.session.post(f"{BACKEND_URL}/streams/{self.test_stream_id}/end", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "message" in result:
                        self.log_test("POST /api/streams/{stream_id}/end", True, "Stream ended successfully")
                        return True
                    else:
                        self.log_test("POST /api/streams/{stream_id}/end", False, "Missing message in response")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/{stream_id}/end", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/{stream_id}/end", False, str(e))
            return False
            
    async def test_schedule_stream(self) -> bool:
        """Test POST /api/streams/schedule"""
        try:
            headers = {"Authorization": f"Bearer {self.streamer_token}"} if self.streamer_token else {}
            # Schedule a stream for 1 hour from now
            future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            
            data = aiohttp.FormData()
            data.add_field("title", "Scheduled Test Stream")
            data.add_field("description", "This is a scheduled stream for testing")
            data.add_field("scheduled_time", future_time)
            data.add_field("enable_super_chat", "true")
            data.add_field("enable_shopping", "false")
            
            async with self.session.post(f"{BACKEND_URL}/streams/schedule", data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    if "stream_id" in result and "scheduled_time" in result:
                        self.log_test("POST /api/streams/schedule", True, f"Stream scheduled with ID: {result['stream_id']}")
                        return True
                    else:
                        self.log_test("POST /api/streams/schedule", False, "Missing stream_id or scheduled_time")
                        return False
                else:
                    text = await response.text()
                    self.log_test("POST /api/streams/schedule", False, f"Status {response.status}: {text}")
                    return False
        except Exception as e:
            self.log_test("POST /api/streams/schedule", False, str(e))
            return False
            
    async def run_all_tests(self):
        """Run all live streaming tests in the specified workflow order"""
        print("🚀 Starting Live Streaming Backend Tests")
        print("=" * 60)
        
        await self.setup_session()
        
        try:
            # Step 1: Get a valid session token from the database
            print("\n📝 Step 1: Getting valid session token...")
            self.streamer_token = await self.get_valid_session_token()
            self.viewer_token = self.streamer_token  # Use same token for both for testing
            
            # Step 2: Test Agora config endpoint
            print("\n🔧 Step 2: Testing Agora configuration...")
            await self.test_agora_config()
            
            # Step 3: Test token generation endpoint
            print("\n🎫 Step 3: Testing token generation...")
            await self.test_token_generation()
            
            # Step 4: Test starting a stream
            print("\n📺 Step 4: Testing stream start...")
            await self.test_start_stream()
            
            # Step 5: Test getting live streams list
            print("\n📋 Step 5: Testing live streams list...")
            await self.test_get_live_streams()
            
            # Step 6: Test getting stream details
            print("\n🔍 Step 6: Testing stream details...")
            await self.test_get_stream_details()
            
            # Step 7: Test joining a stream
            print("\n👥 Step 7: Testing stream join...")
            await self.test_join_stream()
            
            # Step 8: Test leaving a stream
            print("\n🚪 Step 8: Testing stream leave...")
            await self.test_leave_stream()
            
            # Step 9: Test sending chat messages
            print("\n💬 Step 9: Testing chat messages...")
            await self.test_send_chat()
            
            # Step 10: Test sending likes
            print("\n❤️ Step 10: Testing likes...")
            await self.test_send_like()
            
            # Step 11: Test sending gifts
            print("\n🎁 Step 11: Testing gifts...")
            await self.test_send_gift()
            
            # Step 12: Test sending superchat
            print("\n💰 Step 12: Testing superchat...")
            await self.test_send_superchat()
            
            # Step 13: Test ending a stream
            print("\n🛑 Step 13: Testing stream end...")
            await self.test_end_stream()
            
            # Step 14: Test scheduling a future stream
            print("\n⏰ Step 14: Testing stream scheduling...")
            await self.test_schedule_stream()
            
        finally:
            await self.cleanup_session()
            
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            
        print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Live streaming backend is working correctly.")
        else:
            print(f"⚠️  {total - passed} tests failed. See details above.")
            
        return passed == total

async def main():
    """Main test runner"""
    tester = LiveStreamingTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    asyncio.run(main())