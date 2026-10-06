"""Structured JSON logging helpers for API and inference events."""
import json
import logging
from time import perf_counter

logger = logging.getLogger('neuroai')

def log_event(event: str, **fields: object) -> None:
    """Emit a machine-readable application event without sensitive payload data."""
    logger.info(json.dumps({'event': event, **fields}, default=str, separators=(',', ':')))

class Timer:
    """Small request/inference timer used in route and service logs."""
    def __init__(self) -> None: self.started = perf_counter()
    @property
    def milliseconds(self) -> float: return round((perf_counter() - self.started) * 1000, 2)
