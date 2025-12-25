from typing import Any, AsyncGenerator, Optional, Dict
import logging
from google.adk.events.event import Event
from google.genai import types
from google.adk.agents.run_config import RunConfig

logger = logging.getLogger(__name__)

class RemoteAgentWrapper:
    """Wraps a remote agent client to provide a Runner-like interface."""

    def __init__(self, client: Any):
        """
        Args:
            client: An object with an `async_stream_query` method.
        """
        self._client = client

    async def run_async(
        self,
        *,
        user_id: str,
        session_id: str,
        invocation_id: Optional[str] = None,
        new_message: Optional[types.Content] = None,
        state_delta: Optional[Dict[str, Any]] = None,
        run_config: Optional[RunConfig] = None,
    ) -> AsyncGenerator[Event, None]:
        """Runs the remote agent.

        Args:
            user_id: The user ID.
            session_id: The session ID.
            invocation_id: Optional invocation ID (not always supported by remote).
            new_message: The new message to send.
            state_delta: Optional state delta (not always supported by remote).
            run_config: Optional run config.

        Yields:
            Event objects.
        """
        
        # Prepare arguments for async_stream_query
        kwargs = {
            "user_id": user_id,
            "session_id": session_id,
        }

        if new_message:
            # Convert Content to dict or str as expected by client
            # Assuming client accepts Content object or dict
            # For now, let's pass the Content object directly if client supports it,
            # or convert to dict if needed. The cli_deploy.py says message can be str or dict.
            # types.Content is pydantic model, so model_dump should work.
            kwargs["message"] = new_message.model_dump(mode="json", exclude_none=True)
        
        if run_config:
             kwargs["run_config"] = run_config.model_dump(mode="json", exclude_none=True)

        # Note: invocation_id and state_delta might not be supported by standard async_stream_query
        # unless we pass them in kwargs and the remote side handles them.
        # We'll pass them if they are not None.
        if invocation_id:
            kwargs["invocation_id"] = invocation_id
        if state_delta:
            kwargs["state_delta"] = state_delta

        logger.debug(f"Calling remote agent with kwargs: {kwargs.keys()}")

        # Call the remote client
        # We assume client has async_stream_query. 
        # If not, we might need to fallback to stream_query (sync) but run it in thread?
        # The plan assumes async_stream_query.
        
        if hasattr(self._client, "async_stream_query"):
            iterator = self._client.async_stream_query(**kwargs)
        elif hasattr(self._client, "stream_query"):
            # Fallback for sync client, though this is async method
            # This might block loop if not careful, but for now let's assume async is preferred
            logger.warning("Client does not have async_stream_query, using stream_query (might block)")
            iterator = self._client.stream_query(**kwargs)
        else:
            raise AttributeError("Client must have async_stream_query or stream_query method")

        async for chunk in iterator:
            # chunk is expected to be a dict representing an Event
            if isinstance(chunk, dict):
                try:
                    event = Event.model_validate(chunk)
                    yield event
                except Exception as e:
                    logger.error(f"Failed to validate event from remote: {e}")
                    # Optionally yield a partial event or error event?
                    # For now, just log and skip or re-raise?
                    # Re-raising might break the stream.
                    pass
            elif isinstance(chunk, Event):
                yield chunk
            else:
                logger.warning(f"Received unknown chunk type from remote: {type(chunk)}")
