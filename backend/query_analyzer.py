"""
MongoDB Query Analyzer
Analyzes query performance using MongoDB explain plans
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongodb:27017")

async def analyze_queries():
    """Analyze common queries and provide optimization recommendations"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.test_database
    
    print("\n🔍 MongoDB Query Analysis Report")
    print("=" * 80)
    print(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    queries_to_analyze = [
        {
            "name": "Posts Feed Query",
            "collection": "posts",
            "command": {
                "explain": {
                    "find": "posts",
                    "filter": {},
                    "sort": {"created_at": -1},
                    "limit": 20
                },
                "verbosity": "executionStats"
            }
        },
        {
            "name": "User Posts Query",
            "collection": "posts",
            "command": {
                "explain": {
                    "find": "posts",
                    "filter": {"user_id": "test_user"},
                    "sort": {"created_at": -1},
                    "limit": 20
                },
                "verbosity": "executionStats"
            }
        },
        {
            "name": "Post Comments Query",
            "collection": "comments",
            "command": {
                "explain": {
                    "find": "comments",
                    "filter": {"post_id": "test_post"},
                    "sort": {"created_at": -1},
                    "limit": 50
                },
                "verbosity": "executionStats"
            }
        },
        {
            "name": "User Notifications Query",
            "collection": "notifications",
            "command": {
                "explain": {
                    "find": "notifications",
                    "filter": {"user_id": "test_user"},
                    "sort": {"created_at": -1},
                    "limit": 20
                },
                "verbosity": "executionStats"
            }
        },
        {
            "name": "User Follows Query",
            "collection": "follows",
            "command": {
                "explain": {
                    "find": "follows",
                    "filter": {"follower_id": "test_user"}
                },
                "verbosity": "executionStats"
            }
        },
    ]
    
    for query_info in queries_to_analyze:
        print(f"\n{'─' * 80}")
        print(f"📊 {query_info['name']}")
        print(f"{'─' * 80}")
        
        try:
            result = await db.command(query_info['command'])
            
            # Extract execution stats
            exec_stats = result.get('executionStats', {})
            query_planner = result.get('queryPlanner', {})
            
            # Basic stats
            print(f"\n⏱️  Execution Time: {exec_stats.get('executionTimeMillis', 0)}ms")
            print(f"📄 Documents Examined: {exec_stats.get('totalDocsExamined', 0)}")
            print(f"📋 Documents Returned: {exec_stats.get('nReturned', 0)}")
            print(f"🔍 Execution Success: {exec_stats.get('executionSuccess', False)}")
            
            # Index usage
            winning_plan = query_planner.get('winningPlan', {})
            input_stage = winning_plan.get('inputStage', {})
            
            index_name = input_stage.get('indexName', 'NONE')
            stage = input_stage.get('stage', winning_plan.get('stage', 'UNKNOWN'))
            
            print(f"\n📑 Index Used: {index_name}")
            print(f"🎯 Stage: {stage}")
            
            # Performance analysis
            docs_examined = exec_stats.get('totalDocsExamined', 0)
            docs_returned = exec_stats.get('nReturned', 0)
            exec_time = exec_stats.get('executionTimeMillis', 0)
            
            print(f"\n💡 Performance Analysis:")
            
            # Index efficiency
            if index_name == 'NONE' or stage == 'COLLSCAN':
                print("  ⚠️  WARNING: Collection scan (no index used)")
                print("  💡 Recommendation: Add an index for better performance")
            else:
                print(f"  ✅ Index '{index_name}' is being used")
            
            # Examine ratio
            if docs_returned > 0:
                examine_ratio = docs_examined / docs_returned
                if examine_ratio > 10:
                    print(f"  ⚠️  High examine ratio: {examine_ratio:.1f}:1")
                    print("  💡 Recommendation: Optimize query or add covering index")
                elif examine_ratio > 1:
                    print(f"  ⚠️  Examine ratio: {examine_ratio:.1f}:1 (some inefficiency)")
                else:
                    print(f"  ✅ Efficient examine ratio: {examine_ratio:.1f}:1")
            
            # Execution time
            if exec_time > 100:
                print(f"  ⚠️  Slow query: {exec_time}ms")
                print("  💡 Recommendation: Consider optimization or caching")
            elif exec_time > 50:
                print(f"  ⚠️  Moderate speed: {exec_time}ms")
            else:
                print(f"  ✅ Fast query: {exec_time}ms")
            
            # Suggested indexes
            filter_fields = query_info['command']['explain'].get('filter', {})
            sort_fields = query_info['command']['explain'].get('sort', {})
            
            if filter_fields or sort_fields:
                print(f"\n📝 Index Recommendations:")
                if filter_fields and sort_fields:
                    filter_keys = list(filter_fields.keys())
                    sort_keys = list(sort_fields.keys())
                    print(f"  Compound Index: {filter_keys + sort_keys}")
                    print(f"  Command: await db.{query_info['collection']}.create_index([")
                    for key in filter_keys + sort_keys:
                        direction = sort_fields.get(key, 1)
                        print(f"    ('{key}', {direction}),")
                    print(f"  ])")
                elif filter_fields:
                    keys = list(filter_fields.keys())
                    print(f"  Single Index: {keys}")
                elif sort_fields:
                    keys = [(k, v) for k, v in sort_fields.items()]
                    print(f"  Sort Index: {keys}")
            
        except Exception as e:
            print(f"❌ Error analyzing query: {e}")
    
    # Summary
    print(f"\n{'=' * 80}")
    print("📈 Summary")
    print(f"{'=' * 80}")
    print("\n✅ Analysis complete!")
    print("\n💡 Key Recommendations:")
    print("  1. Ensure all frequently queried fields have indexes")
    print("  2. Use compound indexes for filter + sort operations")
    print("  3. Monitor queries with execution time > 50ms")
    print("  4. Keep examine ratio close to 1:1")
    print("  5. Use Redis caching for frequently accessed data")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(analyze_queries())
