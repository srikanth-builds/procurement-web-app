# ag_ui_adk_ext/context.py

"""Context management for AG-UI ADK extension.

Provides a RunContext dataclass and ContextVar for per-request state management,
allowing tools like FrontendToolSet to access available tools and event queues.
"""

from contextvars import ContextVar
from typing import List, Optional, Any
from dataclasses import dataclass
import asyncio


@dataclass
class RunContext:
    """Context for the current agent run.

    Attributes:
        available_tools: List of frontend-provided tools available for this run
        event_queue: Async queue for emitting AG-UI events
        thread_id: The AG-UI thread ID
        run_id: The AG-UI run ID
    """

    available_tools: List[Any]
    event_queue: asyncio.Queue
    thread_id: str
    run_id: str


# Context variable to hold the current run context
run_context: ContextVar[Optional[RunContext]] = ContextVar("run_context", default=None)
