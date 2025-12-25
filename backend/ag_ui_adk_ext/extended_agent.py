# ag_ui_adk_ext/extended_agent.py

"""Extended ADKAgent with plugin support, remote agents, and App integration.

This module extends the official ag_ui_adk ADKAgent with:
- Plugin support via Google ADK BasePlugin
- Remote agent execution via RemoteAgentWrapper
- Direct App object support with ResumabilityConfig
- Session rewind capability
- Activity registry integration
- FrontendToolSet support via RunContext
"""

from __future__ import annotations

from typing import Optional, Dict, Callable, Any, AsyncGenerator, List, Iterable
import asyncio
import logging

from ag_ui.core import (
    RunAgentInput,
    BaseEvent,
    EventType,
    RunStartedEvent,
    RunFinishedEvent,
    RunErrorEvent,
)

from google.adk import Runner
from google.adk.agents import BaseAgent, RunConfig as ADKRunConfig
from google.adk.agents.run_config import StreamingMode
from google.adk.sessions import BaseSessionService, InMemorySessionService
from google.adk.artifacts import BaseArtifactService, InMemoryArtifactService
from google.adk.memory import BaseMemoryService, InMemoryMemoryService
from google.adk.auth.credential_service.base_credential_service import (
    BaseCredentialService,
)
from google.adk.auth.credential_service.in_memory_credential_service import (
    InMemoryCredentialService,
)
from google.genai import types

# Try to import plugin and app support
try:
    from google.adk.plugins import BasePlugin

    HAS_PLUGINS = True
except ImportError:
    HAS_PLUGINS = False
    BasePlugin = None

try:
    from google.adk.apps.app import App, ResumabilityConfig

    HAS_APP = True
except ImportError:
    HAS_APP = False
    App = None
    ResumabilityConfig = None

from ag_ui_adk import ADKAgent, PredictStateMapping, SessionManager
from .extended_event_translator import ExtendedEventTranslator
from .activity_registry import ActivityRegistry
from .context import run_context, RunContext
from .remote_agent_wrapper import RemoteAgentWrapper

logger = logging.getLogger(__name__)


class ExtendedADKAgent(ADKAgent):
    """Extended ADKAgent with plugin support, remote agents, and App integration.

    This class extends the official ADKAgent to add features from custom implementations:

    - **Plugin support**: Pass `plugins: List[BasePlugin]` to apply ADK plugins
    - **Activity registry**: Pass `activity_registry: ActivityRegistry` for smart tool status
    - **Remote agent**: Pass `remote_client` for remote agent execution
    - **App support**: Pass `app: App` to use a pre-configured App object
    - **Session rewind**: Call `rewind_session()` to revert to a previous state
    - **FrontendToolSet**: Tools filtered via RunContext for per-agent control

    Example:
        ```python
        from ag_ui_adk_ext import ExtendedADKAgent, ActivityRegistry, PredictStateMapping

        # Create activity registry
        registry = ActivityRegistry()
        registry.register(
            "search_products",
            running_template="Searching for {query}...",
            completed_template="Found {count} products",
        )

        # Create extended agent
        agent = ExtendedADKAgent(
            adk_agent=my_agent,
            plugins=[MemoryPlugin(), ...],
            activity_registry=registry,
            predict_state=[
                PredictStateMapping(
                    state_key="pr_form",
                    tool="update_pr_state",
                    tool_argument="form_data",
                )
            ],
        )
        ```
    """

    def __init__(
        self,
        # ADK Agent instance (optional if app or remote_client is provided)
        adk_agent: Optional[BaseAgent] = None,
        # App object (optional, alternative to adk_agent)
        app: Optional["App"] = None,
        # Remote Agent Client (optional, alternative to adk_agent)
        remote_client: Optional[Any] = None,
        # App identification
        app_name: Optional[str] = None,
        session_timeout_seconds: Optional[int] = 1200,
        app_name_extractor: Optional[Callable[[RunAgentInput], str]] = None,
        # User identification
        user_id: Optional[str] = None,
        user_id_extractor: Optional[Callable[[RunAgentInput], str]] = None,
        # ADK Services
        session_service: Optional[BaseSessionService] = None,
        artifact_service: Optional[BaseArtifactService] = None,
        memory_service: Optional[BaseMemoryService] = None,
        credential_service: Optional[BaseCredentialService] = None,
        # Configuration
        run_config_factory: Optional[Callable[[RunAgentInput], ADKRunConfig]] = None,
        use_in_memory_services: bool = True,
        # Tool configuration
        execution_timeout_seconds: int = 600,
        tool_timeout_seconds: int = 300,
        max_concurrent_executions: int = 10,
        # Session cleanup configuration
        cleanup_interval_seconds: int = 300,
        # Predictive state configuration (from official package)
        predict_state: Optional[Iterable[PredictStateMapping]] = None,
        # Extended features
        plugins: Optional[List["BasePlugin"]] = None,
        activity_registry: Optional[ActivityRegistry] = None,
        enable_resumability: bool = True,
    ):
        """Initialize the ExtendedADKAgent.

        Args:
            adk_agent: The ADK agent instance to use (optional if app/remote_client provided)
            app: Pre-configured App object (optional, alternative to adk_agent)
            remote_client: Client for remote agent execution (optional)
            app_name: Static application name for all requests
            session_timeout_seconds: Session timeout in seconds
            app_name_extractor: Function to extract app name from input
            user_id: Static user ID for all requests
            user_id_extractor: Function to extract user ID from input
            session_service: Session management service
            artifact_service: File/artifact storage service
            memory_service: Conversation memory and search service
            credential_service: Authentication credential storage
            run_config_factory: Function to create RunConfig per request
            use_in_memory_services: Use in-memory implementations for unspecified services
            execution_timeout_seconds: Timeout for entire execution
            tool_timeout_seconds: Timeout for individual tool calls
            max_concurrent_executions: Maximum concurrent background executions
            cleanup_interval_seconds: Interval for session cleanup
            predict_state: Configuration for predictive state updates
            plugins: List of ADK plugins to apply
            activity_registry: Registry for tool activity status templates
            enable_resumability: Enable resumable sessions via App wrapper
        """
        # Validate input combinations
        if app and adk_agent:
            raise ValueError("Cannot specify both 'app' and 'adk_agent'")

        if not app and not adk_agent and not remote_client:
            raise ValueError(
                "Must specify either 'app', 'adk_agent', or 'remote_client'"
            )

        # Store extended configuration before calling parent
        self._app = app
        self._remote_client = remote_client
        self._plugins = plugins or []
        self._activity_registry = activity_registry
        self._enable_resumability = enable_resumability

        # Initialize remote agent wrapper if client provided
        self._remote_agent_wrapper = None
        if self._remote_client:
            self._remote_agent_wrapper = RemoteAgentWrapper(self._remote_client)

        # Resolve adk_agent from app if needed
        resolved_agent = adk_agent
        if not resolved_agent and app:
            resolved_agent = app.root_agent
        if not resolved_agent and not remote_client:
            raise ValueError("Could not resolve ADK agent from provided arguments")

        # For remote-only mode, create a dummy agent for parent init
        # (We'll override the runner creation anyway)
        if not resolved_agent and remote_client:
            # Create a minimal placeholder - parent won't use it for remote
            from google.adk import Agent

            resolved_agent = Agent(
                name="remote_agent_placeholder",
                model="gemini-2.0-flash-exp",
                instruction="Placeholder for remote agent",
            )

        # Call parent __init__ with resolved agent
        super().__init__(
            adk_agent=resolved_agent,
            app_name=app_name or (app.name if app else None),
            session_timeout_seconds=session_timeout_seconds,
            app_name_extractor=app_name_extractor,
            user_id=user_id,
            user_id_extractor=user_id_extractor,
            session_service=session_service,
            artifact_service=artifact_service,
            memory_service=memory_service,
            credential_service=credential_service,
            run_config_factory=run_config_factory,
            use_in_memory_services=use_in_memory_services,
            execution_timeout_seconds=execution_timeout_seconds,
            tool_timeout_seconds=tool_timeout_seconds,
            max_concurrent_executions=max_concurrent_executions,
            cleanup_interval_seconds=cleanup_interval_seconds,
            predict_state=predict_state,
        )

        logger.info(
            f"ExtendedADKAgent initialized with {len(self._plugins)} plugin(s), "
            f"activity_registry={'yes' if activity_registry else 'no'}, "
            f"remote_client={'yes' if remote_client else 'no'}"
        )

    def _get_app_name(self, input: RunAgentInput) -> str:
        """Resolve app name with extended precedence including App object."""
        if self._app:
            return self._app.name
        return super()._get_app_name(input)

    def _create_runner(
        self, adk_agent: BaseAgent, user_id: str, app_name: str
    ) -> Runner:
        """Create a new runner instance with plugin and App support.

        Extends parent to:
        - Use provided App object if available
        - Wrap agent in App with ResumabilityConfig if enabled
        - Apply plugins
        """
        if self._app:
            # Use provided App directly
            return Runner(
                app=self._app,
                session_service=self._session_manager._session_service,
                artifact_service=self._artifact_service,
                memory_service=self._memory_service,
                credential_service=self._credential_service,
            )

        # Wrap agent in App with plugins and resumability
        if HAS_APP and self._enable_resumability:
            resumability_config = ResumabilityConfig(is_resumable=True)

            app = App(
                name=app_name,
                root_agent=adk_agent,
                resumability_config=resumability_config,
                plugins=self._plugins if HAS_PLUGINS else None,
            )

            return Runner(
                app=app,
                session_service=self._session_manager._session_service,
                artifact_service=self._artifact_service,
                memory_service=self._memory_service,
                credential_service=self._credential_service,
            )

        # Fallback to parent implementation
        return super()._create_runner(adk_agent, user_id, app_name)

    def create_event_translator(
        self, session_state: Optional[Dict[str, Any]] = None
    ) -> ExtendedEventTranslator:
        """Create an ExtendedEventTranslator with activity registry.

        Args:
            session_state: Optional initial session state

        Returns:
            ExtendedEventTranslator instance
        """
        return ExtendedEventTranslator(
            activity_registry=self._activity_registry,
            session_state=session_state or {},
            predict_state=self._predict_state,
        )

    async def rewind_session(self, session_id: str, invocation_id: str) -> None:
        """Rewind the session to before the specified invocation.

        This allows reverting a session to a previous state, useful for
        "undo" functionality or recovering from errors.

        Args:
            session_id: The session ID
            invocation_id: The invocation ID to rewind before

        Raises:
            ValueError: If session not found or metadata cannot be resolved
        """
        # Resolve metadata
        app_name = self._static_app_name
        user_id = self._static_user_id

        if not (app_name and user_id):
            metadata = self._get_session_metadata(session_id)
            if metadata:
                app_name = app_name or metadata["app_name"]
                user_id = user_id or metadata["user_id"]

        if not (app_name and user_id):
            raise ValueError(
                f"Could not resolve app_name and user_id for session {session_id}"
            )

        # Create runner
        runner = self._create_runner(
            adk_agent=self._adk_agent,
            user_id=user_id,
            app_name=app_name,
        )

        # Call rewind_async
        await runner.rewind_async(
            user_id=user_id,
            session_id=session_id,
            rewind_before_invocation_id=invocation_id,
        )

        logger.info(
            f"Session {session_id} rewound to before invocation {invocation_id}"
        )

    async def _run_adk_in_background(
        self,
        input: RunAgentInput,
        adk_agent: Any,
        user_id: str,
        app_name: str,
        event_queue: asyncio.Queue,
        tool_results: Optional[List[Dict]] = None,
        message_batch: Optional[List[Any]] = None,
    ):
        """Override to use ExtendedEventTranslator with ActivityRegistry.

        This override is necessary because the base ADKAgent._run_adk_in_background
        directly instantiates EventTranslator, bypassing create_event_translator().
        We need ExtendedEventTranslator for activity status template support.
        
        Also sets run_context for FrontendToolSet and step tools.
        """
        import json
        import time
        import inspect
        from typing import Dict, List
        from google.genai import types as genai_types
        from ag_ui.core import EventType, ToolCallEndEvent, ToolCallResultEvent

        # Set run context for this background task
        ctx = RunContext(
            event_queue=event_queue,
            thread_id=input.thread_id,
            run_id=input.run_id,
            available_tools=getattr(input, "tools", []) or [],
        )
        token = run_context.set(ctx)
        logger.debug(
            f"_run_adk_in_background - context set for thread={input.thread_id}"
        )

        runner: Optional[Runner] = None
        try:
            # Create runner
            runner = self._create_runner(
                adk_agent=adk_agent,
                user_id=user_id,
                app_name=app_name
            )

            # Create RunConfig
            run_config = self._run_config_factory(input)

            # Ensure session exists
            await self._ensure_session_exists(
                app_name, user_id, input.thread_id, input.state
            )

            # Sync frontend state to backend
            await self._session_manager.update_session_state(
                input.thread_id, app_name, user_id, input.state
            )

            # Get session state for activity templates
            session_state = await self._session_manager.get_session_state(
                input.thread_id, app_name, user_id
            ) or {}

            # Convert messages
            unseen_messages = message_batch if message_batch is not None else await self._get_unseen_messages(input)

            active_tool_results: Optional[List[Dict]] = tool_results
            if active_tool_results is None and await self._is_tool_result_submission(input, unseen_messages):
                active_tool_results = await self._extract_tool_results(input, unseen_messages)

            if active_tool_results:
                tool_messages = [result["message"] for result in active_tool_results]
                message_ids = self._collect_message_ids(tool_messages)
                if message_ids:
                    self._session_manager.mark_messages_processed(app_name, input.thread_id, message_ids)
            elif unseen_messages:
                message_ids = self._collect_message_ids(unseen_messages)
                if message_ids:
                    self._session_manager.mark_messages_processed(app_name, input.thread_id, message_ids)

            # Convert user messages
            user_message = await self._convert_latest_message(input, unseen_messages)

            # Build the new_message for ADK
            if active_tool_results and user_message:
                # Both tool results AND user message
                function_response_parts = []
                for tool_msg in active_tool_results:
                    tool_call_id = tool_msg['message'].tool_call_id
                    content = tool_msg['message'].content

                    try:
                        if content and content.strip():
                            try:
                                result = json.loads(content)
                            except json.JSONDecodeError:
                                result = {"success": True, "result": content, "status": "completed"}
                        else:
                            result = {"success": True, "result": None, "status": "completed"}
                    except Exception:
                        result = {"success": True, "result": str(content) if content else None, "status": "completed"}

                    function_response_parts.append(genai_types.Part(
                        function_response=genai_types.FunctionResponse(
                            id=tool_call_id,
                            name=tool_msg["tool_name"],
                            response=result,
                        )
                    ))

                # Add FunctionResponse to session
                session = await self._session_manager.get_or_create_session(
                    session_id=input.thread_id,
                    app_name=app_name,
                    user_id=user_id,
                    initial_state=input.state
                )

                from google.adk.sessions.session import Event
                function_response_content = genai_types.Content(parts=function_response_parts, role='user')
                function_response_event = Event(
                    timestamp=time.time(),
                    author='user',
                    content=function_response_content
                )
                session.events.append(function_response_event)

                if message_batch:
                    user_message_ids = self._collect_message_ids(message_batch)
                    if user_message_ids:
                        self._session_manager.mark_messages_processed(app_name, input.thread_id, user_message_ids)

                new_message = user_message

            elif active_tool_results:
                # Tool results without user message
                function_response_parts = []
                for tool_msg in active_tool_results:
                    tool_call_id = tool_msg['message'].tool_call_id
                    content = tool_msg['message'].content

                    try:
                        if content and content.strip():
                            try:
                                result = json.loads(content)
                            except json.JSONDecodeError:
                                result = {"success": True, "result": content, "status": "completed"}
                        else:
                            result = {"success": True, "result": None, "status": "completed"}
                    except Exception:
                        result = {"success": True, "result": str(content) if content else None, "status": "completed"}

                    function_response_parts.append(genai_types.Part(
                        function_response=genai_types.FunctionResponse(
                            id=tool_call_id,
                            name=tool_msg["tool_name"],
                            response=result,
                        )
                    ))

                new_message = genai_types.Content(parts=function_response_parts, role='user')
            else:
                # Just user message
                if user_message is None and input.messages:
                    user_message = await self._convert_latest_message(input, input.messages)
                new_message = user_message

            # CRITICAL FIX: Use ExtendedEventTranslator with ActivityRegistry
            event_translator = self.create_event_translator(session_state)

            # Run ADK agent
            is_long_running_tool = False
            run_kwargs = {
                "user_id": user_id,
                "session_id": input.thread_id,
                "new_message": new_message,
                "run_config": run_config
            }

            async for adk_event in runner.run_async(**run_kwargs):
                final_response = adk_event.is_final_response()
                has_content = adk_event.content and hasattr(adk_event.content, 'parts') and adk_event.content.parts

                is_streaming_chunk = (
                    getattr(adk_event, 'partial', False) or
                    (not getattr(adk_event, 'turn_complete', True)) or
                    (not final_response)
                )

                # Check for LRO function call
                has_lro_function_call = False
                try:
                    lro_ids = set(getattr(adk_event, 'long_running_tool_ids', []) or [])
                    if lro_ids and adk_event.content and getattr(adk_event.content, 'parts', None):
                        for part in adk_event.content.parts:
                            func = getattr(part, 'function_call', None)
                            func_id = getattr(func, 'id', None) if func else None
                            if func_id and func_id in lro_ids:
                                has_lro_function_call = True
                                break
                except Exception:
                    has_lro_function_call = False

                if (not has_lro_function_call) and (is_streaming_chunk or (has_content and not getattr(adk_event, 'finish_reason', None))):
                    # Regular translation path - uses ExtendedEventTranslator
                    async for ag_ui_event in event_translator.translate(
                        adk_event,
                        input.thread_id,
                        input.run_id
                    ):
                        logger.debug(f"Emitting event: {type(ag_ui_event).__name__}")
                        await event_queue.put(ag_ui_event)
                else:
                    # LRO tool events
                    async for end_event in event_translator.force_close_streaming_message():
                        await event_queue.put(end_event)

                    async for ag_ui_event in event_translator.translate_lro_function_calls(adk_event):
                        await event_queue.put(ag_ui_event)
                        if ag_ui_event.type == EventType.TOOL_CALL_END:
                            is_long_running_tool = True

                    if is_long_running_tool:
                        return

            # Force close streaming messages
            async for ag_ui_event in event_translator.force_close_streaming_message():
                await event_queue.put(ag_ui_event)

            # Emit final state snapshot
            final_state = await self._session_manager.get_session_state(
                input.thread_id, app_name, user_id
            )
            if final_state:
                ag_ui_event = event_translator._create_state_snapshot_event(final_state)
                await event_queue.put(ag_ui_event)

            # Emit deferred confirm_changes events
            for deferred_event in event_translator.get_and_clear_deferred_confirm_events():
                await event_queue.put(deferred_event)

            # Signal completion
            await event_queue.put(None)

        except Exception as e:
            logger.error(f"Background execution error: {e}", exc_info=True)
            await event_queue.put(
                RunErrorEvent(
                    type=EventType.RUN_ERROR,
                    message=str(e),
                    code="BACKGROUND_EXECUTION_ERROR"
                )
            )
            await event_queue.put(None)
        finally:
            run_context.reset(token)
            # Clean up runner
            if runner is not None:
                close_method = getattr(runner, "close", None)
                if close_method is not None:
                    try:
                        close_result = close_method()
                        if inspect.isawaitable(close_result):
                            await close_result
                    except Exception as close_error:
                        logger.warning(
                            "Error closing runner for thread %s: %s",
                            input.thread_id,
                            close_error,
                        )

    async def run(
        self,
        input: RunAgentInput,
    ) -> AsyncGenerator[BaseEvent, None]:
        """Run the agent with RunContext automatically set.

        This overrides the parent run() to automatically set up RunContext
        so that FrontendToolSet and step tools can access the event queue
        and available tools.

        Args:
            input: The AG-UI run input

        Yields:
            AG-UI protocol events
        """
        # Create event queue for this run
        event_queue = asyncio.Queue()

        # Extract tools from input
        available_tools = getattr(input, "tools", []) or []

        # Set up run context
        ctx = RunContext(
            available_tools=available_tools,
            event_queue=event_queue,
            thread_id=input.thread_id,
            run_id=input.run_id,
        )

        # Set context and run parent method
        token = run_context.set(ctx)
        logger.debug(
            f"ExtendedADKAgent.run() - context set for thread={input.thread_id}, run={input.run_id}"
        )
        try:
            # Run parent implementation
            async for event in super().run(input):
                # Yield the ADK event first
                yield event

                # Then yield any events that were queued by tools during this iteration
                # This ensures step events are interleaved in the stream
                while not event_queue.empty():
                    queued_event = event_queue.get_nowait()
                    yield queued_event

            # Final drain of any remaining queued events
            while not event_queue.empty():
                queued_event = event_queue.get_nowait()
                yield queued_event
        finally:
            run_context.reset(token)

    async def run_with_context(
        self,
        input: RunAgentInput,
        available_tools: Optional[List[Any]] = None,
    ) -> AsyncGenerator[BaseEvent, None]:
        """Run the agent with explicit tools (legacy method).

        Note: The run() method now automatically sets context.
        This method is kept for backward compatibility.

        Args:
            input: The AG-UI run input
            available_tools: List of frontend-provided tools (overrides input.tools)

        Yields:
            AG-UI protocol events
        """
        # If explicit tools provided, temporarily override input tools
        if available_tools is not None:
            original_tools = getattr(input, "tools", [])
            input.tools = available_tools
            try:
                async for event in self.run(input):
                    yield event
            finally:
                input.tools = original_tools
        else:
            async for event in self.run(input):
                yield event

    @property
    def plugins(self) -> List["BasePlugin"]:
        """Get the list of plugins."""
        return self._plugins

    @property
    def activity_registry(self) -> Optional[ActivityRegistry]:
        """Get the activity registry."""
        return self._activity_registry

    @property
    def is_remote(self) -> bool:
        """Check if this agent uses a remote client."""
        return self._remote_client is not None
