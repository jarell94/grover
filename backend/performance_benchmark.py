#!/usr/bin/env python3
import asyncio
import os
import statistics
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

BASE_URL = os.getenv("BASE_URL", "http://localhost:8001/api")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.getenv("DB_NAME", "test_database")
TOKEN = os.getenv("GROVER_TOKEN")  # optional bearer token


def ms_since(t0: float) -> float:
    return (time.perf_counter() - t0) * 1000.0


def pct(values, p):
    if not values:
        return None
    values_sorted = sorted(values)
    k = int(round((p / 100) * (len(values_sorted) - 1)))
    return values_sorted[max(0, min(k, len(values_sorted) - 1))]


def status_api(p95_ms: float) -> str:
    return "🟢" if p95_ms < 100 else "🟡" if p95_ms < 300 else "🔴"


def status_db(p95_ms: float) -> str:
    return "🟢" if p95_ms < 50 else "🟡" if p95_ms < 150 else "🔴"


async def bench(name: str, func, runs: int = 8, warmup: int = 1):
    # warmup
    for _ in range(warmup):
        await func()

    times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        await func()
        times.append(ms_since(t0))

    p50 = pct(times, 50)
    p95 = pct(times, 95)
    p99 = pct(times, 99)
    avg = statistics.mean(times)

    return name, avg, p50, p95, p99


async def get_sample_ids(db):
    # sample real IDs so perf tests reflect real workload
    post = await db.posts.find({}, {"_id": 1, "user_id": 1}).sort("created_at", -1).limit(1).to_list(1)
    user = await db.users.find({}, {"_id": 1}).limit(1).to_list(1)

    post_id = post[0]["_id"] if post else None
    post_user_id = post[0].get("user_id") if post else None
    user_id = user[0]["_id"] if user else post_user_id

    follower = await db.follows.find({}, {"follower_id": 1, "followed_id": 1}).limit(1).to_list(1)
    follower_id = follower[0]["follower_id"] if follower else user_id

    return {"post_id": post_id, "user_id": user_id, "follower_id": follower_id}


async def check_indexes(db):
    print("\n🔍 Database Index Status")
    print("=" * 60)

    required = {
        "posts": [{"created_at": -1}, {"user_id": 1, "created_at": -1}],
        "follows": [{"follower_id": 1}, {"followed_id": 1}, {"follower_id": 1, "followed_id": 1}],
        "comments": [{"post_id": 1, "created_at": -1}],
        "reactions": [{"post_id": 1}, {"post_id": 1, "user_id": 1}],
        "notifications": [{"user_id": 1, "created_at": -1}],
    }

    for coll, expected in required.items():
        idx = await db[coll].list_indexes().to_list(None)
        keys = [i["key"] for i in idx]  # SON mappings
        missing = []
        for exp in expected:
            if not any(dict(k) == exp for k in keys):
                missing.append(exp)

        status = "🟢" if not missing else "🟡"
        print(f"{status} {coll:<14} indexes={len(idx)}")
        if missing:
            for m in missing:
                print(f"   └─ missing: {m}")


async def test_db(db):
    print("\n📊 Database Performance Test Results")
    print("=" * 60)

    ids = await get_sample_ids(db)
    post_id = ids["post_id"]
    user_id = ids["user_id"]
    follower_id = ids["follower_id"]

    async def q_posts_created_at():
        return await db.posts.find({}).sort("created_at", -1).limit(20).to_list(20)

    async def q_posts_with_user_lookup():
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$limit": 10},
            {"$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "user_id",
                "as": "user",
            }},
            {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
            {"$project": {"user.password": 0}},  # adjust to your schema
        ]
        return await db.posts.aggregate(pipeline).to_list(10)

    async def q_user_follows():
        if follower_id is None:
            return []
        return await db.follows.find({"follower_id": follower_id}).limit(200).to_list(200)

    async def q_reactions_by_post():
        if post_id is None:
            return []
        return await db.reactions.find({"post_id": post_id}).limit(200).to_list(200)

    async def q_comments_by_post():
        if post_id is None:
            return []
        return await db.comments.find({"post_id": post_id}).sort("created_at", -1).limit(50).to_list(50)

    async def q_user_notifications():
        if user_id is None:
            return []
        return await db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(20).to_list(20)

    queries = [
        ("Posts by created_at", q_posts_created_at),
        ("Posts + user $lookup", q_posts_with_user_lookup),
        ("User follows lookup", q_user_follows),
        ("Reactions by post", q_reactions_by_post),
        ("Comments by post", q_comments_by_post),
        ("User notifications", q_user_notifications),
    ]

    for name, fn in queries:
        try:
            _, avg, p50, p95, p99 = await bench(name, fn)
            s = status_db(p95)
            print(f"{s} {name:<22} avg={avg:>6.1f}ms  p50={p50:>6.1f}  p95={p95:>6.1f}  p99={p99:>6.1f}")
        except Exception as e:
            print(f"❌ {name}: Error - {e}")


async def test_api():
    print("\n🚀 API Performance Test Results")
    print("=" * 60)

    endpoints = [
        ("/posts/feed?limit=10&skip=0", "Feed (10)"),
        ("/posts/feed?limit=20&skip=0", "Feed (20)"),
        ("/posts/feed?limit=50&skip=0", "Feed (50)"),
        ("/posts/explore?limit=10&skip=0", "Explore (10)"),
        ("/posts/explore?limit=20&skip=0", "Explore (20)"),
        ("/posts?limit=10&skip=0", "Posts (10)"),
        ("/posts?limit=20&skip=0", "Posts (20)"),
    ]

    headers = {}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:

        async def one(url):
            t0 = time.perf_counter()
            r = await client.get(url)
            dt = ms_since(t0)
            size = len(r.content or b"")
            return r.status_code, dt, size

        for path, name in endpoints:
            url = f"{BASE_URL}{path}"
            try:
                # warmup
                await one(url)

                # sequential
                seq_times = []
                for _ in range(8):
                    code, dt, _ = await one(url)
                    if code != 200:
                        raise RuntimeError(f"HTTP {code}")
                    seq_times.append(dt)

                p95 = pct(seq_times, 95)
                s = status_api(p95)
                print(f"{s} {name:<12} seq  p50={pct(seq_times,50):>6.1f}ms  p95={p95:>6.1f}ms")

                # concurrency (burst of 10)
                async def burst():
                    results = await asyncio.gather(*[one(url) for _ in range(10)])
                    dts = [dt for code, dt, _ in results if code == 200]
                    return dts

                burst_times = await burst()
                if burst_times:
                    print(f"   └─ burst x10     p50={pct(burst_times,50):>6.1f}ms  p95={pct(burst_times,95):>6.1f}ms")

            except Exception as e:
                print(f"❌ {name}: Error - {e}")


async def main():
    print("🎯 Grover App Performance Monitor")
    print("=" * 60)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    await check_indexes(db)
    await test_db(db)
    await test_api()

    client.close()

    print("\n✅ Performance monitoring complete!")
    print("\nGuidelines (p95):")
    print("🟢 Excellent: API < 100ms, DB < 50ms")
    print("🟡 Good:      API < 300ms, DB < 150ms")
    print("🔴 Fix:       above those thresholds")


if __name__ == "__main__":
    asyncio.run(main())
