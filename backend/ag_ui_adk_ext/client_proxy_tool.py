# ag_ui_adk_ext/client_proxy_tool.py

"""Extended ClientProxyTool with summarize_response support.

This module extends the official ClientProxyTool to add the summarize_response
configuration that controls whether the LLM should comment on tool results.
"""

import asyncio
import json
import uuid
import inspect
from typing import Any, Optional, Dict
import logging

from google.adk.tools import BaseTool, LongRunningFunctionTool
from google.genai import types
from ag_ui.core import Tool as AGUITool, EventType
from ag_ui.core import ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent

logger = logging.getLogger(__name__)


class ExtendedClientProxyTool(BaseTool):
    """Extended ClientProxyTool with summarize_response support.

    This tool adds the `tool_config` parameter that supports:
    - `summarize_response`: If False, sets `skip_summarization=True` on the
      tool context to prevent the LLM from generating text about the tool result.

    Example:
        ```python
        tool = ExtendedClientProxyTool(
            ag_ui_tool=some_tool,
            event_queue=queue,
            tool_config={"summarize_response": False}  # Silent execution
        )
        ```
    """

    def __init__(
        self,
        ag_ui_tool: AGUITool,
        event_queue: asyncio.Queue,
        tool_config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize the extended client proxy tool.

        Args:
            ag_ui_tool: The AG-UI tool definition
            event_queue: Queue to emit AG-UI events
            tool_config: Configuration dict, supports:
                - summarize_response (bool): If False, LLM won't comment on result
        """
        super().__init__(
            name=ag_ui_tool.name,
            description=ag_ui_tool.description,
            is_long_running=True,
        )

        self.ag_ui_tool = ag_ui_tool
        self.event_queue = event_queue
        self.tool_config = tool_config or {}

        # Create dynamic function with proper parameter signatures for ADK inspection
        sig_params = []
        parameters = ag_ui_tool.parameters
        if isinstance(parameters, dict) and "properties" in parameters:
            for param_name in parameters["properties"].keys():
                sig_params.append(
                    inspect.Parameter(
                        param_name,
                        inspect.Parameter.KEYWORD_ONLY,
                        default=None,
                        annotation=Any,
                    )
                )

        async def proxy_tool_func(**kwargs) -> Any:
            original_args = getattr(self, "_current_args", kwargs)
            original_tool_context = getattr(self, "_current_tool_context", None)
            return await self._execute_proxy_tool(original_args, original_tool_context)

        proxy_tool_func.__name__ = ag_ui_tool.name
        proxy_tool_func.__doc__ = ag_ui_tool.description

        if sig_params:
            proxy_tool_func.__signature__ = inspect.Signature(sig_params)

        self._long_running_tool = LongRunningFunctionTool(proxy_tool_func)

    def _get_declaration(self) -> Optional[types.FunctionDeclaration]:
        """Create FunctionDeclaration from AG-UI tool parameters."""
        logger.debug(f"_get_declaration called for {self.name}")

        parameters = self.ag_ui_tool.parameters
        if not isinstance(parameters, dict):
            parameters = {"type": "object", "properties": {}}
            logger.warning(
                f"Tool {self.name} had non-dict parameters, using empty schema"
            )

        function_declaration = types.FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters=types.Schema.model_validate(parameters),
        )
        return function_declaration

    async def run_async(self, *, args: dict[str, Any], tool_context: Any) -> Any:
        """Execute the tool by delegating to the internal LongRunningFunctionTool."""
        self._current_args = args
        self._current_tool_context = tool_context
        return await self._long_running_tool.run_async(
            args=args, tool_context=tool_context
        )

    async def _execute_proxy_tool(self, args: Dict[str, Any], tool_context: Any) -> Any:
        """Execute the proxy tool logic - emit events and return a response.

        Args:
            args: Tool arguments from ADK
            tool_context: ADK tool context

        Returns:
            Dict response to satisfy LLM protocol
        """
        logger.debug(f"Proxy tool execution: {self.ag_ui_tool.name}")
        logger.debug(f"Arguments received: {args}")

        # Extract ADK-generated function call ID if available
        adk_function_call_id = None
        if tool_context and hasattr(tool_context, "function_call_id"):
            adk_function_call_id = tool_context.function_call_id
            logger.debug(f"Using ADK function_call_id: {adk_function_call_id}")

        tool_call_id = adk_function_call_id or f"call_{uuid.uuid4().hex[:8]}"

        try:
            # Emit TOOL_CALL_START event
            start_event = ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=tool_call_id,
                tool_call_name=self.ag_ui_tool.name,
            )
            await self.event_queue.put(start_event)
            logger.debug(f"Emitted TOOL_CALL_START for {tool_call_id}")

            # Emit TOOL_CALL_ARGS event
            args_json = json.dumps(args)
            args_event = ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS,
                tool_call_id=tool_call_id,
                delta=args_json,
            )
            await self.event_queue.put(args_event)
            logger.debug(f"Emitted TOOL_CALL_ARGS for {tool_call_id}")

            # Emit TOOL_CALL_END event
            end_event = ToolCallEndEvent(
                type=EventType.TOOL_CALL_END, tool_call_id=tool_call_id
            )
            await self.event_queue.put(end_event)
            logger.debug(f"Emitted TOOL_CALL_END for {tool_call_id}")

            # KEY FEATURE: Handle summarize_response config
            should_summarize = self.tool_config.get("summarize_response", False)

            if hasattr(tool_context, "actions") and tool_context.actions is not None:
                # Set skip_summarization based on configuration
                # If we want to summarize, skip_summarization should be False
                # If we want to be silent, skip_summarization should be True
                tool_context.actions.skip_summarization = not should_summarize
                logger.debug(
                    f"Set skip_summarization to {tool_context.actions.skip_summarization} "
                    f"for proxy tool {self.ag_ui_tool.name} (ID: {tool_call_id})"
                )

            # Return a response to satisfy the LLM protocol
            response_content = {"status": "ok", "tool_name": self.ag_ui_tool.name}

            if should_summarize:
                # Provide more detail if the LLM is going to see it
                response_content["message"] = (
                    f"Tool '{self.ag_ui_tool.name}' executed successfully."
                )
                logger.debug(
                    f"Returning detailed response for proxy tool {self.ag_ui_tool.name}"
                )
            else:
                logger.debug(
                    f"Returning minimal response for proxy tool {self.ag_ui_tool.name}"
                )

            return response_content

        except Exception as e:
            logger.error(f"Error in proxy tool execution for {tool_call_id}: {e}")
            raise

    def __repr__(self) -> str:
        """String representation of the proxy tool."""
        return f"ExtendedClientProxyTool(name='{self.name}', summarize={self.tool_config.get('summarize_response', False)})"
