# ag_ui_adk_ext/__init__.py

"""Extended ADK Middleware for AG-UI Protocol.

This package extends the official ag_ui_adk package with additional features:
- ActivityRegistry: Tool activity status templates with running/completed/failure states
- FrontendToolSet: Per-agent filtering of frontend tools
- RunContext: ContextVar for per-request state management
- Plugin support: Google ADK BasePlugin integration
- Remote agent support: Wrapper for remote agent execution
- App support: Direct App object with ResumabilityConfig
- Session rewind: Rewind session to before a specific invocation
"""

from __future__ import annotations

import logging
import os
from typing import Dict, Iterable

# Re-export everything from the official package
from ag_ui_adk import (
    ADKAgent,
    add_adk_fastapi_endpoint,
    create_adk_app,
    EventTranslator,
    SessionManager,
    PredictStateMapping,
    normalize_predict_state,
)

# Import our extensions
from .extended_agent import ExtendedADKAgent
from .extended_event_translator import ExtendedEventTranslator
from .activity_registry import ActivityRegistry
from .frontend_tool_set import FrontendToolSet
from .context import run_context, RunContext
from .remote_agent_wrapper import RemoteAgentWrapper
from .client_proxy_tool import ExtendedClientProxyTool

__all__ = [
    # Re-exported from official package
    "ADKAgent",
    "add_adk_fastapi_endpoint",
    "create_adk_app",
    "EventTranslator",
    "SessionManager",
    "PredictStateMapping",
    "normalize_predict_state",
    # Our extensions
    "ExtendedADKAgent",
    "ExtendedEventTranslator",
    "ActivityRegistry",
    "FrontendToolSet",
    "run_context",
    "RunContext",
    "RemoteAgentWrapper",
    "ExtendedClientProxyTool",
]

__version__ = "0.1.0"


def _configure_logging_from_env() -> None:
    """Configure component loggers based on environment variables."""

    root_level = os.getenv("LOG_ROOT_LEVEL")
    if root_level:
        try:
            level = getattr(logging, root_level.upper())
        except AttributeError:
            logging.getLogger(__name__).warning(
                "Invalid LOG_ROOT_LEVEL value '%s'", root_level
            )
        else:
            logging.basicConfig(level=level, force=True)

    component_levels: Dict[str, Iterable[str]] = {
        "LOG_ADK_AGENT_EXT": ("ag_ui_adk_ext.extended_agent",),
        "LOG_EVENT_TRANSLATOR_EXT": ("ag_ui_adk_ext.extended_event_translator",),
        "LOG_ACTIVITY_REGISTRY": ("ag_ui_adk_ext.activity_registry",),
        "LOG_FRONTEND_TOOLSET": ("ag_ui_adk_ext.frontend_tool_set",),
    }

    for env_var, logger_names in component_levels.items():
        level_name = os.getenv(env_var)
        if not level_name:
            continue

        try:
            level = getattr(logging, level_name.upper())
        except AttributeError:
            logging.getLogger(__name__).warning(
                "Invalid value '%s' for %s", level_name, env_var
            )
            continue

        for logger_name in logger_names:
            logging.getLogger(logger_name).setLevel(level)


_configure_logging_from_env()
