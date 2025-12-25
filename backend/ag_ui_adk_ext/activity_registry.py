# ag_ui_adk_ext/activity_registry.py

"""Registry for managing tool activity status templates.

This module provides ActivityRegistry class that allows defining templates
for 'running', 'completed', and 'failure' states, with support for injecting
values from the session state.
"""

from typing import Dict, Any, Optional, List, Union, Callable
import logging

logger = logging.getLogger(__name__)


class ActivityRegistry:
    """
    Registry for managing tool activity status templates.
    Allows defining templates for 'running', 'completed', and 'failure' states,
    with support for injecting values from the session state.
    """

    def __init__(self):
        self._registry: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        tool_name: str,
        running_template: Optional[Union[str, Callable]] = None,
        completed_template: Optional[Union[str, Callable]] = None,
        failure_template: Optional[Union[str, Callable]] = None,
        inject_state_keys: Optional[List[str]] = None,
    ):
        """
        Register activity templates for a tool.

        Args:
            tool_name: The name of the tool (e.g., 'tavily_search_advanced').
            running_template: Template for when the tool starts (e.g., "Searching for {query}...").
            completed_template: Template for when the tool finishes successfully.
            failure_template: Template for when the tool fails.
            inject_state_keys: List of keys to fetch from session state and make available to templates.
        """
        self._registry[tool_name] = {
            "running": running_template,
            "completed": completed_template,
            "failure": failure_template,
            "inject_keys": inject_state_keys or [],
        }

    def get_activity(
        self,
        tool_name: str,
        status: str,
        tool_args: Dict[str, Any] = None,
        tool_result: Any = None,
        error: str = None,
        session_state: Dict[str, Any] = None,
    ) -> Optional[str]:
        """
        Generate a formatted activity status string.

        Args:
            tool_name: The name of the tool being executed.
            status: One of 'running', 'completed', 'failure'.
            tool_args: The arguments passed to the tool.
            tool_result: The result returned by the tool (for 'completed' status).
            error: The error message (for 'failure' status).
            session_state: The current session state for injection.

        Returns:
            Formatted status string, or None if no template is found.
        """
        # 1. Find the registration (handle exact match or MCP namespaced match)
        config = self._registry.get(tool_name)

        # MCP Support: If exact match fails, try to match the suffix (e.g. 'server__tool_name')
        if not config:
            for registered_name, conf in self._registry.items():
                if tool_name.endswith(
                    f"__{registered_name}"
                ):  # MCP convention: server__tool
                    config = conf
                    break

        if not config:
            return None

        template = config.get(status)
        if not template:
            return None

        # 2. Prepare context for formatting
        context = {}

        # Add tool arguments
        if tool_args:
            context.update(tool_args)

        # Add tool result (if completed)
        if status == "completed" and tool_result is not None:
            context["result"] = tool_result
            # Flatten result if it's a dict to allow direct access to keys
            if isinstance(tool_result, dict):
                context.update(tool_result)

        # Add error (if failure)
        if status == "failure" and error:
            context["error"] = error

        # Add injected session state values
        if session_state and config["inject_keys"]:
            for key in config["inject_keys"]:
                if key in session_state:
                    context[key] = session_state[key]

        # Sanitize keys for formatting (replace ':' with '_')
        # This allows state keys like "temp:user_name" to be referenced as "{temp_user_name}"
        sanitized_updates = {}
        for key, value in context.items():
            if ":" in key:
                sanitized_updates[key.replace(":", "_")] = value
        context.update(sanitized_updates)

        # 3. Format the string safely
        class SafeDict(dict):
            def __missing__(self, key):
                return "{" + key + "}"

        try:
            # CRITICAL FEATURE: Support callable templates for dynamic logic
            if callable(template):
                # If template is a function, call it with the context
                try:
                    formatted_activity = template(context)
                except Exception as e:
                    logger.error(
                        f"Error executing dynamic template for {tool_name}: {e}"
                    )
                    return None
            else:
                # Standard string template
                formatted_activity = template.format_map(SafeDict(context))

            logger.debug(f"Formatted activity: {formatted_activity}")
            return formatted_activity
        except Exception as e:
            logger.error(f"Error formatting activity template for {tool_name}: {e}")
            return str(template) if not callable(template) else None
