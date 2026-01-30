"""
Prometheus Metrics Configuration for Grover Backend

This module sets up Prometheus metrics collection for monitoring:
- HTTP request latency
- Request counts by endpoint
- Error rates
- Custom business metrics
"""

from prometheus_fastapi_instrumentator import Instrumentator, metrics
from prometheus_client import Counter, Histogram, Gauge
import time

# Custom metrics
ACTIVE_USERS = Gauge(
    'grover_active_users_total',
    'Number of currently active users'
)

POSTS_CREATED = Counter(
    'grover_posts_created_total',
    'Total number of posts created',
    ['post_type']
)

AUTH_ATTEMPTS = Counter(
    'grover_auth_attempts_total',
    'Total authentication attempts',
    ['method', 'status']
)

API_LATENCY = Histogram(
    'grover_api_latency_seconds',
    'API endpoint latency in seconds',
    ['endpoint', 'method'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

DB_QUERY_LATENCY = Histogram(
    'grover_db_query_latency_seconds',
    'Database query latency in seconds',
    ['collection', 'operation'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

MESSAGES_SENT = Counter(
    'grover_messages_sent_total',
    'Total messages sent'
)

TRANSACTIONS = Counter(
    'grover_transactions_total',
    'Total monetary transactions',
    ['type', 'status']
)

STREAMS_ACTIVE = Gauge(
    'grover_active_streams',
    'Number of currently active live streams'
)


def setup_metrics(app):
    """
    Initialize Prometheus metrics instrumentation for FastAPI app.
    
    Args:
        app: FastAPI application instance
    """
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health", "/ready"],
        inprogress_name="grover_http_requests_inprogress",
        inprogress_labels=True,
    )
    
    # Add default metrics
    instrumentator.add(
        metrics.default(
            metric_namespace="grover",
            metric_subsystem="http",
        )
    )
    
    # Add latency histogram
    instrumentator.add(
        metrics.latency(
            metric_namespace="grover",
            metric_subsystem="http",
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        )
    )
    
    # Add request size metric
    instrumentator.add(
        metrics.request_size(
            metric_namespace="grover",
            metric_subsystem="http",
        )
    )
    
    # Add response size metric
    instrumentator.add(
        metrics.response_size(
            metric_namespace="grover",
            metric_subsystem="http",
        )
    )
    
    # Instrument and expose metrics endpoint
    instrumentator.instrument(app).expose(app, endpoint="/api/metrics", include_in_schema=True)
    
    return instrumentator


# Helper functions for tracking custom metrics
def track_post_created(post_type: str = "standard"):
    """Track when a post is created."""
    POSTS_CREATED.labels(post_type=post_type).inc()


def track_auth_attempt(method: str, success: bool):
    """Track authentication attempts."""
    status = "success" if success else "failure"
    AUTH_ATTEMPTS.labels(method=method, status=status).inc()


def track_message_sent():
    """Track when a message is sent."""
    MESSAGES_SENT.inc()


def track_transaction(transaction_type: str, success: bool):
    """Track monetary transactions."""
    status = "success" if success else "failure"
    TRANSACTIONS.labels(type=transaction_type, status=status).inc()


def set_active_users(count: int):
    """Set the current active users gauge."""
    ACTIVE_USERS.set(count)


def set_active_streams(count: int):
    """Set the current active streams gauge."""
    STREAMS_ACTIVE.set(count)


class DBQueryTimer:
    """
    Context manager for timing database queries.
    
    Usage:
        with DBQueryTimer('users', 'find_one'):
            result = await db.users.find_one({...})
    """
    def __init__(self, collection: str, operation: str):
        self.collection = collection
        self.operation = operation
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        DB_QUERY_LATENCY.labels(
            collection=self.collection,
            operation=self.operation
        ).observe(duration)
        return False
