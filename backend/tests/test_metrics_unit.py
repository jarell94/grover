import time
from fastapi import FastAPI

from metrics import (
    setup_metrics,
    track_post_created,
    track_auth_attempt,
    track_message_sent,
    track_transaction,
    set_active_users,
    set_active_streams,
    DBQueryTimer,
    POSTS_CREATED,
    AUTH_ATTEMPTS,
    MESSAGES_SENT,
    TRANSACTIONS,
    ACTIVE_USERS,
    STREAMS_ACTIVE,
    DB_QUERY_LATENCY,
)


def test_setup_metrics_registers_endpoint():
    app = FastAPI()
    instrumentator = setup_metrics(app)

    assert instrumentator is not None
    assert any(route.path == "/api/metrics" for route in app.routes)


def test_metric_helpers_update_counters_and_gauges():
    posts_before = POSTS_CREATED.labels(post_type="standard")._value.get()
    auth_before = AUTH_ATTEMPTS.labels(method="password", status="success")._value.get()
    messages_before = MESSAGES_SENT._value.get()
    transactions_before = TRANSACTIONS.labels(type="tip", status="success")._value.get()

    track_post_created("standard")
    track_auth_attempt("password", True)
    track_message_sent()
    track_transaction("tip", True)
    set_active_users(12)
    set_active_streams(3)

    assert POSTS_CREATED.labels(post_type="standard")._value.get() == posts_before + 1
    assert AUTH_ATTEMPTS.labels(method="password", status="success")._value.get() == auth_before + 1
    assert MESSAGES_SENT._value.get() == messages_before + 1
    assert TRANSACTIONS.labels(type="tip", status="success")._value.get() == transactions_before + 1
    assert ACTIVE_USERS._value.get() == 12
    assert STREAMS_ACTIVE._value.get() == 3


def test_db_query_timer_records_latency():
    labels = DB_QUERY_LATENCY.labels(collection="users", operation="find")
    before_sum = labels._sum.get()

    with DBQueryTimer("users", "find"):
        time.sleep(0.001)

    assert labels._sum.get() > before_sum
