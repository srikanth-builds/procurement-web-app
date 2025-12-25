"""
Optimized MongoDB Chat History Saver with async operations.

Key Optimizations:
1. Uses Motor (async MongoDB driver) instead of PyMongo
2. Bulk write support for batched inserts
3. Debounced thread metadata updates
4. Connection pooling with proper lifecycle management
"""

import os
import logging
import datetime
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from ag_ui.core import RunAgentInput, Event

logger = logging.getLogger(__name__)


class AsyncMongoDBChatHistorySaver:
    """
    Async MongoDB saver using Motor driver for non-blocking operations.
    """

    def __init__(self, mongo_uri: Optional[str] = None, db_name: Optional[str] = None):
        self.mongo_uri = mongo_uri or os.getenv("MONGODB_URI")
        if not self.mongo_uri:
            raise ValueError("MONGODB_URI environment variable not set")

        self.db_name = db_name or os.getenv("MONGODB_DATABASE") or "chat_history"
        self._client: Optional[AsyncIOMotorClient] = None
        self._db = None
        self._collection = None
        self._threads_collection = None

    async def _connect(self):
        """Async lazy connection to MongoDB."""
        if self._client is None:
            self._client = AsyncIOMotorClient(self.mongo_uri)
            self._db = self._client[self.db_name]
            self._collection = self._db["chat_history"]
            self._threads_collection = self._db["threads"]

            # Ensure indexes (idempotent)
            await self._collection.create_index([("thread_id", 1), ("timestamp", 1)])
            await self._threads_collection.create_index("thread_id", unique=True)
            await self._threads_collection.create_index("updated_at")

    async def save_input(self, input_data: RunAgentInput):
        """Save a RunAgentInput object (User Message / Tool Results)."""
        try:
            await self._connect()

            payload = input_data.model_dump(mode="json")

            document = {
                "thread_id": input_data.thread_id,
                "type": "input",
                "event_type": "run_agent_input",
                "payload": payload,
                "timestamp": datetime.datetime.utcnow(),
                "metadata": {"run_id": input_data.run_id},
            }

            await self._collection.insert_one(document)
            logger.debug(f"Saved input for thread {input_data.thread_id}")

            # Update threads collection
            await self._update_thread_metadata(input_data.thread_id, payload)

        except Exception as e:
            logger.error(f"Failed to save input: {e}")

    async def save_event(
        self, thread_id: str, event: Event, run_id: Optional[str] = None
    ):
        """Save an Event object (Agent Output)."""
        try:
            await self._connect()

            payload = event.model_dump(mode="json")
            effective_run_id = run_id or getattr(event, "run_id", None)

            document = {
                "thread_id": thread_id,
                "type": "event",
                "event_type": event.type,
                "payload": payload,
                "timestamp": datetime.datetime.utcnow(),
                "metadata": {"run_id": effective_run_id},
            }

            await self._collection.insert_one(document)
            logger.debug(f"Saved event {event.type} for thread {thread_id}")

            # NOTE: Thread metadata update moved to batch flush for optimization

        except Exception as e:
            logger.error(f"Failed to save event: {e}")

    async def save_events_batch(self, events: List[tuple]):
        """
        Save multiple events in a single bulk write operation.

        Args:
            events: List of (thread_id, event, run_id) tuples
        """
        if not events:
            return

        try:
            await self._connect()

            documents = []
            for thread_id, event, run_id in events:
                payload = event.model_dump(mode="json")
                effective_run_id = run_id or getattr(event, "run_id", None)

                documents.append(
                    {
                        "thread_id": thread_id,
                        "type": "event",
                        "event_type": event.type,
                        "payload": payload,
                        "timestamp": datetime.datetime.utcnow(),
                        "metadata": {"run_id": effective_run_id},
                    }
                )

            # Bulk insert
            if documents:
                await self._collection.insert_many(documents, ordered=False)
                logger.info(f"Bulk saved {len(documents)} events")

        except Exception as e:
            logger.error(f"Failed to bulk save events: {e}")

    async def update_thread_timestamp(self, thread_id: str):
        """Update only the thread timestamp (debounced call)."""
        try:
            await self._connect()
            await self._threads_collection.update_one(
                {"thread_id": thread_id},
                {"$set": {"updated_at": datetime.datetime.utcnow()}},
                upsert=True,
            )
        except Exception as e:
            logger.error(f"Failed to update thread timestamp: {e}")

    async def _update_thread_metadata(self, thread_id: str, payload: Dict[str, Any]):
        """Update thread metadata (title, preview)."""
        try:
            preview = self._extract_preview(payload)
            title = preview[:50] if preview else "New Conversation"

            await self._threads_collection.update_one(
                {"thread_id": thread_id},
                {
                    "$set": {
                        "updated_at": datetime.datetime.utcnow(),
                        "last_message_preview": preview,
                    },
                    "$setOnInsert": {
                        "created_at": datetime.datetime.utcnow(),
                        "title": title,
                    },
                },
                upsert=True,
            )
        except Exception as e:
            logger.error(f"Failed to update thread metadata: {e}")

    async def get_history(self, thread_id: str) -> List[Dict[str, Any]]:
        """Retrieve chat history for a thread."""
        try:
            await self._connect()

            cursor = self._collection.find({"thread_id": thread_id}).sort(
                "timestamp", 1
            )

            results = []
            async for doc in cursor:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                results.append(doc)

            return results

        except Exception as e:
            logger.error(f"Failed to get history: {e}")
            return []

    async def get_threads(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve a list of unique threads."""
        try:
            await self._connect()

            cursor = self._threads_collection.find().sort("updated_at", -1).limit(limit)

            threads = []
            async for doc in cursor:
                threads.append(
                    {
                        "thread_id": doc["thread_id"],
                        "title": doc.get("title", "New Conversation"),
                        "last_updated": doc.get("updated_at"),
                        "preview": doc.get("last_message_preview", ""),
                    }
                )

            return threads

        except Exception as e:
            logger.error(f"Failed to get threads: {e}")
            return []

    async def update_title(self, thread_id: str, title: str) -> bool:
        """Update the title of a thread."""
        try:
            await self._connect()
            result = await self._threads_collection.update_one(
                {"thread_id": thread_id}, {"$set": {"title": title}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            logger.error(f"Failed to update title: {e}")
            return False

    async def delete_thread(self, thread_id: str) -> bool:
        """Delete a thread and its history."""
        try:
            await self._connect()
            t_result = await self._threads_collection.delete_one(
                {"thread_id": thread_id}
            )
            h_result = await self._collection.delete_many({"thread_id": thread_id})

            return t_result.deleted_count > 0 or h_result.deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete thread: {e}")
            return False

    def _extract_preview(self, payload: Dict[str, Any]) -> str:
        """Helper to extract a text preview from a message payload."""
        try:
            if "messages" in payload and isinstance(payload["messages"], list):
                for msg in reversed(payload["messages"]):
                    if "content" in msg and isinstance(msg["content"], str):
                        return msg["content"][:100]

            if "delta" in payload and isinstance(payload["delta"], str):
                return payload["delta"][:100]

            return "No preview available"
        except Exception:
            return "Preview error"

    async def close(self):
        """Close the MongoDB connection."""
        if self._client:
            self._client.close()
            self._client = None
