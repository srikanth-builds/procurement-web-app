from contextvars import ContextVar
from typing import List, Optional, Any
from dataclasses import dataclass
import asyncio


@dataclass
class RunContext:
    """Context for the current agent run."""

    available_tools: List[Any]
    event_queue: asyncio.Queue
    thread_id: str
    run_id: str


# Context variable to hold the current run context
run_context: ContextVar[Optional[RunContext]] = ContextVar("run_context", default=None)
