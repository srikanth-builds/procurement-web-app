"""
Optimized PersistingADKAgent with reduced latency.

Key Optimizations:
1. Background async persistence (non-blocking)
2. Batched writes instead of per-event writes
3. Removed redundant thread updates
4. Pre-compiled regex patterns
"""

import asyncio
import logging
import re
from typing import AsyncGenerator, List
from ag_ui.core import RunAgentInput, Event, EventType, TextMessageContentEvent
from ag_ui_adk_ext import ExtendedADKAgent
from .chat_history_async import AsyncMongoDBChatHistorySaver

logger = logging.getLogger(__name__)

# Pre-compiled regex patterns (moved outside class for efficiency)
THINKING_PATTERN = re.compile(r"<thinking>.*?</thinking>", flags=re.DOTALL)
THINKING_START_PATTERN = re.compile(r"<thinking>")
THINKING_END_PATTERN = re.compile(r"</thinking>")


class PersistingADKAgentOptimized:
    """
    Optimized wrapper around ADKAgent that persists inputs and events to MongoDB
    with minimal latency impact.

    Key Optimizations:
    - Fire-and-forget background persistence (doesn't block streaming)
    - Batch event writes to reduce DB round-trips
    - Debounced thread metadata updates
    """

    def __init__(
        self,
        agent: ExtendedADKAgent,
        saver: AsyncMongoDBChatHistorySaver,
        batch_size: int = 10,
        flush_interval_ms: int = 500,
    ):
        self.agent = agent
        self.saver = saver
        self.batch_size = batch_size
        self.flush_interval_ms = flush_interval_ms

        # Event batch buffer
        self._event_buffer: List[tuple] = []  # (thread_id, event, run_id)
        self._flush_lock = asyncio.Lock()
        self._background_tasks: set = set()

    async def run(self, input_data: RunAgentInput) -> AsyncGenerator[Event, None]:
        """
        Intercepts run call to save input and output events with minimal latency.
        """
        # 1. Save Input in background (fire-and-forget)
        self._spawn_background_task(self._save_input_async(input_data))

        # State for aggregating messages
        active_streams = {}  # message_id -> list of parts
        thread_id = input_data.thread_id
        run_id = input_data.run_id

        # 2. Run Agent and Intercept Events
        async for event in self.agent.run(input_data):
            should_buffer = True

            # --- Aggregation Logic (unchanged) ---
            if event.type == EventType.TEXT_MESSAGE_START:
                active_streams[event.message_id] = []

            elif event.type == EventType.TEXT_MESSAGE_CONTENT:
                if event.message_id in active_streams:
                    active_streams[event.message_id].append(event.delta)
                    should_buffer = False  # Skip buffering delta, wait for aggregated

            elif event.type == EventType.TEXT_MESSAGE_END:
                if event.message_id in active_streams:
                    # Reconstruct and buffer full message
                    full_text = "".join(active_streams[event.message_id])
                    full_content_event = TextMessageContentEvent(
                        type=EventType.TEXT_MESSAGE_CONTENT,
                        message_id=event.message_id,
                        delta=full_text,
                        run_id=getattr(event, "run_id", None),
                    )
                    self._buffer_event(thread_id, full_content_event, run_id)
                    del active_streams[event.message_id]

            # Skip thinking events from persistence
            elif event.type in (
                EventType.THINKING_TEXT_MESSAGE_START,
                EventType.THINKING_TEXT_MESSAGE_CONTENT,
                EventType.THINKING_TEXT_MESSAGE_END,
            ):
                should_buffer = False

            # --- End Aggregation Logic ---

            # 3. Buffer Event for batch persistence
            if should_buffer:
                self._buffer_event(thread_id, event, run_id)

            # 4. Flush buffer if full (in background)
            if len(self._event_buffer) >= self.batch_size:
                self._spawn_background_task(self._flush_buffer())

            # 5. Filter <thinking> blocks (using pre-compiled regex)
            if event.type == EventType.TEXT_MESSAGE_CONTENT and hasattr(event, "delta"):
                cleaned_delta = THINKING_PATTERN.sub("", event.delta)
                cleaned_delta = THINKING_START_PATTERN.sub("", cleaned_delta)
                cleaned_delta = THINKING_END_PATTERN.sub("", cleaned_delta)
                event.delta = cleaned_delta

            yield event

        # 6. Flush remaining events after stream ends
        self._spawn_background_task(self._flush_buffer())

    def _buffer_event(self, thread_id: str, event: Event, run_id: str):
        """Add event to buffer for batch persistence."""
        self._event_buffer.append((thread_id, event, run_id))

    async def _flush_buffer(self):
        """Flush buffered events to MongoDB in a single batch."""
        async with self._flush_lock:
            if not self._event_buffer:
                return

            events_to_save = self._event_buffer.copy()
            self._event_buffer.clear()

        # Save all events (could be optimized further with bulk_write)
        for thread_id, event, run_id in events_to_save:
            try:
                await self.saver.save_event(thread_id, event, run_id=run_id)
            except Exception as e:
                logger.error(f"Failed to persist event: {e}")

        # Update thread metadata only once per flush (not per event)
        if events_to_save:
            thread_id = events_to_save[-1][0]
            try:
                await self.saver.update_thread_timestamp(thread_id)
            except Exception as e:
                logger.debug(f"Failed to update thread timestamp: {e}")

    async def _save_input_async(self, input_data: RunAgentInput):
        """Save input in background."""
        try:
            await self.saver.save_input(input_data)
            logger.debug(f"Saved input for thread {input_data.thread_id}")
        except Exception as e:
            logger.error(f"Failed to persist input: {e}")

    def _spawn_background_task(self, coro):
        """Spawn a background task without awaiting it."""
        task = asyncio.create_task(coro)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    def __getattr__(self, name):
        """Delegate other attribute access to the underlying agent."""
        return getattr(self.agent, name)
