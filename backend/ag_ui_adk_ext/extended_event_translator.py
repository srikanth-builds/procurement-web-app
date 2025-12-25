# ag_ui_adk_ext/extended_event_translator.py

"""Extended EventTranslator with activity registry and thinking events support.

This module extends the official ag_ui_adk EventTranslator with:
- ActivityRegistry integration for smart tool activity status
- Thinking/reasoning events support (ThinkingStart, ThinkingTextMessage*, ThinkingEnd)
- Enhanced tool call/response handling with session state awareness
"""

from __future__ import annotations

import dataclasses
from collections.abc import Iterable, Mapping
from typing import AsyncGenerator, Optional, Dict, Any, List
import uuid
import json

from google.genai import types
from ag_ui.core import (
    BaseEvent,
    EventType,
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    ToolCallStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    StateSnapshotEvent,
    StateDeltaEvent,
    CustomEvent,
)

# Import thinking events if available (may not be in all versions of ag_ui)
try:
    from ag_ui.core import (
        ThinkingStartEvent,
        ThinkingTextMessageStartEvent,
        ThinkingTextMessageContentEvent,
        ThinkingTextMessageEndEvent,
        ThinkingEndEvent,
        ActivitySnapshotEvent,
    )

    HAS_THINKING_EVENTS = True
except ImportError:
    HAS_THINKING_EVENTS = False

from google.adk.events import Event as ADKEvent
from ag_ui_adk import EventTranslator, PredictStateMapping

from .activity_registry import ActivityRegistry

import logging

logger = logging.getLogger(__name__)


def _coerce_tool_response(value: Any, _visited: Optional[set[int]] = None) -> Any:
    """Recursively convert arbitrary tool responses into JSON-serializable structures."""

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    if isinstance(value, (bytes, bytearray, memoryview)):
        try:
            return value.decode()
        except Exception:
            return list(value)

    if _visited is None:
        _visited = set()

    obj_id = id(value)
    if obj_id in _visited:
        return str(value)

    _visited.add(obj_id)
    try:
        if dataclasses.is_dataclass(value) and not isinstance(value, type):
            return {
                field.name: _coerce_tool_response(getattr(value, field.name), _visited)
                for field in dataclasses.fields(value)
            }

        if hasattr(value, "_asdict") and callable(getattr(value, "_asdict")):
            try:
                return {
                    str(k): _coerce_tool_response(v, _visited)
                    for k, v in value._asdict().items()
                }
            except Exception:
                pass

        for method_name in ("model_dump", "to_dict"):
            method = getattr(value, method_name, None)
            if callable(method):
                try:
                    dumped = method()
                except TypeError:
                    try:
                        dumped = method(exclude_none=False)
                    except Exception:
                        continue
                except Exception:
                    continue
                return _coerce_tool_response(dumped, _visited)

        if isinstance(value, Mapping):
            return {
                str(k): _coerce_tool_response(v, _visited) for k, v in value.items()
            }

        if isinstance(value, (list, tuple, set, frozenset)):
            return [_coerce_tool_response(item, _visited) for item in value]

        if isinstance(value, Iterable):
            try:
                return [_coerce_tool_response(item, _visited) for item in list(value)]
            except TypeError:
                pass

        try:
            obj_vars = vars(value)
        except TypeError:
            obj_vars = None

        if obj_vars:
            coerced = {
                key: _coerce_tool_response(val, _visited)
                for key, val in obj_vars.items()
                if not key.startswith("_")
            }
            if coerced:
                return coerced

        return str(value)
    finally:
        _visited.discard(obj_id)


def _serialize_tool_response(response: Any) -> str:
    """Serialize a tool response into a JSON string."""
    try:
        coerced = _coerce_tool_response(response)
        return json.dumps(coerced, ensure_ascii=False)
    except Exception as exc:
        logger.warning("Failed to coerce tool response to JSON: %s", exc, exc_info=True)
        try:
            return json.dumps(str(response), ensure_ascii=False)
        except Exception:
            logger.warning("Failed to stringify tool response; returning empty string.")
            return json.dumps("", ensure_ascii=False)


class ExtendedEventTranslator(EventTranslator):
    """Extended EventTranslator with activity registry and thinking events support.

    This class extends the official ag_ui_adk EventTranslator to add:
    - ActivityRegistry: Smart activity status templates for tool execution
    - Thinking events: Support for reasoning/thinking events in streaming
    - Session state awareness: Pass session state to activity templates

    Example:
        ```python
        registry = ActivityRegistry()
        registry.register(
            "search_products",
            running_template="Searching for {query}...",
            completed_template="Found {count} products for {query}",
        )

        translator = ExtendedEventTranslator(
            activity_registry=registry,
            session_state={"user_name": "John"},
            predict_state=[...]
        )
        ```
    """

    def __init__(
        self,
        activity_registry: Optional[ActivityRegistry] = None,
        session_state: Optional[Dict[str, Any]] = None,
        predict_state: Optional[Iterable[PredictStateMapping]] = None,
    ):
        """Initialize the extended event translator.

        Args:
            activity_registry: Registry for tool activity status templates
            session_state: Current session state for activity template injection
            predict_state: Configuration for predictive state updates
        """
        # Initialize parent class
        super().__init__(predict_state=predict_state)

        # Extension state
        self.activity_registry = activity_registry
        self.session_state = session_state or {}

        # Extended tool call tracking (store args for activity completion)
        self._active_tool_calls_ext: Dict[str, Dict[str, Any]] = {}

        # Reasoning state (for thinking events)
        self._is_reasoning: bool = False
        self._reasoning_message_id: Optional[str] = None
        self._last_streamed_thought_run_id: Optional[str] = None

    def update_session_state(self, state_delta: Dict[str, Any]) -> None:
        """Update the local session state with a delta.

        Args:
            state_delta: Dictionary of state changes
        """
        self.session_state.update(state_delta)

    async def translate(
        self, adk_event: ADKEvent, thread_id: str, run_id: str
    ) -> AsyncGenerator[BaseEvent, None]:
        """Translate an ADK event to AG-UI protocol events.

        Extends parent translate with:
        - Session state updates
        - Thinking events handling
        - Activity snapshots for tool calls

        Args:
            adk_event: The ADK event to translate
            thread_id: The AG-UI thread ID
            run_id: The AG-UI run ID

        Yields:
            One or more AG-UI protocol events
        """
        # Update local session state if there's a delta
        if (
            hasattr(adk_event, "actions")
            and adk_event.actions
            and hasattr(adk_event.actions, "state_delta")
            and adk_event.actions.state_delta
        ):
            logger.debug(
                f"Updating local session state with delta: {adk_event.actions.state_delta.keys()}"
            )
            self.session_state.update(adk_event.actions.state_delta)

        # Handle thinking events if we have thinking content
        if (
            HAS_THINKING_EVENTS
            and adk_event.content
            and hasattr(adk_event.content, "parts")
        ):
            async for event in self._handle_thinking_content(adk_event, run_id):
                yield event

        # Emit activity snapshots for function calls
        if self.activity_registry and hasattr(adk_event, "get_function_calls"):
            function_calls = adk_event.get_function_calls()
            if function_calls:
                for func_call in function_calls:
                    async for event in self._emit_activity_for_call(func_call):
                        yield event

        # Emit activity snapshots for function responses
        if self.activity_registry and hasattr(adk_event, "get_function_responses"):
            function_responses = adk_event.get_function_responses()
            if function_responses:
                for func_response in function_responses:
                    async for event in self._emit_activity_for_response(func_response):
                        yield event

        # Delegate to parent for standard translation
        async for event in super().translate(adk_event, thread_id, run_id):
            yield event

    async def _handle_thinking_content(
        self, adk_event: ADKEvent, run_id: str
    ) -> AsyncGenerator[BaseEvent, None]:
        """Handle thinking/reasoning content in ADK events.

        Emits thinking events when the ADK event contains parts marked as thoughts.
        """
        if not adk_event.content or not adk_event.content.parts:
            return

        is_final_response = False
        if hasattr(adk_event, "is_final_response"):
            if callable(adk_event.is_final_response):
                is_final_response = adk_event.is_final_response()
            else:
                is_final_response = adk_event.is_final_response

        for part in adk_event.content.parts:
            is_thought = getattr(part, "thought", False)

            if is_thought:
                # Skip duplicate thoughts on final response
                if is_final_response and self._last_streamed_thought_run_id == run_id:
                    continue

                # Start reasoning if not already
                if not self._is_reasoning:
                    self._is_reasoning = True
                    self._reasoning_message_id = str(uuid.uuid4())
                    self._last_streamed_thought_run_id = run_id

                    yield ThinkingStartEvent(
                        type=EventType.THINKING_START,
                        message_id=self._reasoning_message_id,
                    )
                    yield ThinkingTextMessageStartEvent(
                        type=EventType.THINKING_TEXT_MESSAGE_START,
                        message_id=self._reasoning_message_id,
                    )

                # Emit thinking content
                if part.text:
                    self._last_streamed_thought_run_id = run_id
                    yield ThinkingTextMessageContentEvent(
                        type=EventType.THINKING_TEXT_MESSAGE_CONTENT,
                        message_id=self._reasoning_message_id,
                        delta=part.text,
                    )
            else:
                # Regular content - close reasoning if active
                if self._is_reasoning and self._reasoning_message_id:
                    yield ThinkingTextMessageEndEvent(
                        type=EventType.THINKING_TEXT_MESSAGE_END,
                        message_id=self._reasoning_message_id,
                    )
                    yield ThinkingEndEvent(
                        type=EventType.THINKING_END,
                        message_id=self._reasoning_message_id,
                    )
                    self._is_reasoning = False
                    self._reasoning_message_id = None

    async def _emit_activity_for_call(
        self, func_call: types.FunctionCall
    ) -> AsyncGenerator[BaseEvent, None]:
        """Emit activity snapshot for a function call starting."""
        if not self.activity_registry:
            return

        tool_call_id = getattr(func_call, "id", str(uuid.uuid4()))
        tool_args = (
            func_call.args
            if hasattr(func_call, "args") and isinstance(func_call.args, dict)
            else {}
        )

        # Store for later use in completion
        self._active_tool_calls_ext[tool_call_id] = {
            "name": func_call.name,
            "args": tool_args,
        }

        activity_text = self.activity_registry.get_activity(
            tool_name=func_call.name,
            status="running",
            tool_args=tool_args,
            session_state=self.session_state,
        )

        if activity_text and HAS_THINKING_EVENTS:
            yield ActivitySnapshotEvent(
                type=EventType.ACTIVITY_SNAPSHOT,
                message_id=str(uuid.uuid4()),
                activity_type="tool_execution",
                content={
                    "text": activity_text,
                    "status": "running",
                    "tool": func_call.name,
                    "tool_id": tool_call_id,
                },
            )

    async def _emit_activity_for_response(
        self, func_response: types.FunctionResponse
    ) -> AsyncGenerator[BaseEvent, None]:
        """Emit activity snapshot for a function response (completed/failed)."""
        if not self.activity_registry:
            return

        tool_call_id = getattr(func_response, "id", None)
        tool_name = getattr(func_response, "name", None)

        if not tool_name:
            return

        # Get original args if available
        tool_args = {}
        if tool_call_id and tool_call_id in self._active_tool_calls_ext:
            tool_args = self._active_tool_calls_ext[tool_call_id].get("args", {})
            # Clean up tracking
            del self._active_tool_calls_ext[tool_call_id]

        # Check for error in response
        error_message = None
        response_content = func_response.response

        if isinstance(response_content, dict) and "error" in response_content:
            error_message = response_content["error"]
        elif isinstance(response_content, str) and response_content.startswith(
            "Error:"
        ):
            error_message = response_content

        if error_message:
            activity_text = self.activity_registry.get_activity(
                tool_name=tool_name,
                status="failure",
                error=error_message,
                session_state=self.session_state,
                tool_args=tool_args,
            )
            activity_status = "failure"
        else:
            # Coerce response for template
            coerced_response = _coerce_tool_response(response_content)
            activity_text = self.activity_registry.get_activity(
                tool_name=tool_name,
                status="completed",
                tool_result=coerced_response,
                session_state=self.session_state,
                tool_args=tool_args,
            )
            activity_status = "completed"

        if activity_text and HAS_THINKING_EVENTS:
            yield ActivitySnapshotEvent(
                type=EventType.ACTIVITY_SNAPSHOT,
                message_id=str(uuid.uuid4()),
                activity_type=f"tool_execution_{activity_status}",
                content={
                    "text": activity_text,
                    "status": activity_status,
                    "tool": tool_name,
                    "tool_id": tool_call_id,
                },
            )

    async def force_close_streaming_message(self) -> AsyncGenerator[BaseEvent, None]:
        """Force close any open streaming message including reasoning.

        Extends parent to also close thinking messages.
        """
        # Close parent streaming
        async for event in super().force_close_streaming_message():
            yield event

        # Close reasoning if active
        if HAS_THINKING_EVENTS and self._is_reasoning and self._reasoning_message_id:
            logger.warning(
                f"Force-closing unterminated reasoning message: {self._reasoning_message_id}"
            )
            yield ThinkingTextMessageEndEvent(
                type=EventType.THINKING_TEXT_MESSAGE_END,
                message_id=self._reasoning_message_id,
            )
            yield ThinkingEndEvent(
                type=EventType.THINKING_END,
                message_id=self._reasoning_message_id,
            )
            self._is_reasoning = False
            self._reasoning_message_id = None

    def reset(self) -> None:
        """Reset the translator state.

        Extends parent reset to also reset extended state.
        """
        super().reset()

        # Reset extended state
        self._active_tool_calls_ext.clear()
        self._is_reasoning = False
        self._reasoning_message_id = None
        self._last_streamed_thought_run_id = None

        logger.debug("Reset ExtendedEventTranslator state")

    # Internal state keys that should not be exposed to the frontend
    INTERNAL_STATE_KEYS = {
        "pending_tool_calls",
        "ui_context",
        "_internal",
    }

    def _create_state_snapshot_event(
        self,
        state_snapshot: Dict[str, Any],
    ) -> StateSnapshotEvent:
        """Create a state snapshot event, filtering out internal keys.
        
        This overrides the parent to filter internal state keys like
        'pending_tool_calls' which shouldn't be exposed to the frontend.
        
        Args:
            state_snapshot: The raw state from ADK session
            
        Returns:
            A StateSnapshotEvent with filtered state
        """
        # Filter out internal keys
        filtered_state = {
            k: v for k, v in state_snapshot.items()
            if k not in self.INTERNAL_STATE_KEYS and not k.startswith("_")
        }
        
        return StateSnapshotEvent(
            type=EventType.STATE_SNAPSHOT,
            snapshot=filtered_state
        )

