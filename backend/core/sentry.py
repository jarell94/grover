"""
Sentry Integration - Error tracking and performance monitoring
"""
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from core.config import (
    SENTRY_DSN, 
    ENVIRONMENT, 
    APP_VERSION,
    SENTRY_TRACES_SAMPLE_RATE,
    SENTRY_PROFILES_SAMPLE_RATE
)

logger = logging.getLogger(__name__)


def init_sentry():
    """Initialize Sentry for error tracking and performance monitoring"""
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
            ],
            # Set traces_sample_rate to capture performance data
            traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
            # Set profiles_sample_rate to profile transactions
            profiles_sample_rate=SENTRY_PROFILES_SAMPLE_RATE,
            # Capture user info (without PII)
            send_default_pii=False,
            # Release version
            release=APP_VERSION,
        )
        logger.info(f"Sentry initialized for environment: {ENVIRONMENT}")
    else:
        logger.warning("SENTRY_DSN not set - error tracking disabled")
