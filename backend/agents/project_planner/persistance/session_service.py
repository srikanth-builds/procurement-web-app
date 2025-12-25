import asyncio
import logging
import uuid
import time
import copy
from typing import Any, Optional, List, Dict
from pymongo import MongoClient
from google.adk.sessions import BaseSessionService, Session
from google.adk.sessions.base_session_service import GetSessionConfig, ListSessionsResponse
from google.adk.sessions.state import State
from google.adk.events import Event

logger = logging.getLogger(__name__)

class MongoDBSessionService(BaseSessionService):
    """
    MongoDB implementation of the SessionService.
    Persists sessions, events, and state to MongoDB.
    """

    def __init__(self, mongo_uri: str, db_name: str = "adk_sessions"):
        self.mongo_uri = mongo_uri
        self.db_name = db_name
        self._client = None
        self._db = None
        self._sessions_col = None
        self._events_col = None

    def _connect(self):
        """Lazy connection to MongoDB."""
        if self._client is None:
            self._client = MongoClient(self.mongo_uri)
            self._db = self._client[self.db_name]
            self._sessions_col = self._db["sessions"]
            self._events_col = self._db["events"]
            
            # Indexes
            self._sessions_col.create_index([("app_name", 1), ("user_id", 1), ("id", 1)], unique=True)
            self._events_col.create_index([("session_id", 1), ("timestamp", 1)])

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        return await asyncio.to_thread(
            self._create_session_sync,
            app_name=app_name,
            user_id=user_id,
            state=state,
            session_id=session_id
        )

    def _create_session_sync(
        self,
        app_name: str,
        user_id: str,
        state: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        self._connect()
        
        if session_id:
            existing = self._sessions_col.find_one({
                "app_name": app_name,
                "user_id": user_id,
                "id": session_id
            })
            if existing:
                # If exists, return it (idempotent) or raise error? 
                # BaseSessionService raises AlreadyExistsError usually, but let's be robust.
                # For now, let's raise to match spec.
                raise ValueError(f"Session {session_id} already exists")

        session_id = session_id or str(uuid.uuid4())
        now = time.time()
        
        session_doc = {
            "id": session_id,
            "app_name": app_name,
            "user_id": user_id,
            "state": state or {},
            "last_update_time": now,
            "created_at": now
        }
        
        self._sessions_col.insert_one(session_doc)
        
        return Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=state or {},
            last_update_time=now,
            events=[]
        )

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        return await asyncio.to_thread(
            self._get_session_sync,
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            config=config
        )

    def _get_session_sync(
        self,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        self._connect()
        
        doc = self._sessions_col.find_one({
            "app_name": app_name,
            "user_id": user_id,
            "id": session_id
        })
        
        if not doc:
            return None
            
        # Fetch events
        query = {"session_id": session_id}
        if config and config.after_timestamp:
            query["timestamp"] = {"$gt": config.after_timestamp}
            
        cursor = self._events_col.find(query).sort("timestamp", 1)
        
        if config and config.num_recent_events:
            # This is inefficient for large histories without reverse sort limit, 
            # but standard mongo doesn't do "last N" easily without sort desc limit.
            # Let's fetch all and slice for correctness or optimize later.
            # Optimization: Sort DESC, Limit N, then reverse.
            cursor = self._events_col.find(query).sort("timestamp", -1).limit(config.num_recent_events)
            events_data = list(cursor)
            events_data.reverse()
        else:
            events_data = list(cursor)

        events = []
        for ed in events_data:
            # Reconstruct Event object
            # We stored the dump, so we need to parse it back.
            # Assuming we store the model_dump() in 'payload' or root.
            # Let's assume we store the dict directly.
            # We need to handle the 'type' field which might be reserved in Mongo? No.
            try:
                # Remove mongo _id
                ed.pop("_id", None)
                ed.pop("session_id", None) # Remove foreign key
                
                # Handle timestamp conversion if needed (mongo might store as datetime)
                # Event expects float timestamp.
                # If we stored as float, it's fine.
                
                event = Event.model_validate(ed)
                events.append(event)
            except Exception as e:
                logger.error(f"Failed to parse event {ed.get('id')}: {e}")

        return Session(
            id=doc["id"],
            app_name=doc["app_name"],
            user_id=doc["user_id"],
            state=doc.get("state", {}),
            last_update_time=doc.get("last_update_time", 0),
            events=events
        )

    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        return await asyncio.to_thread(
            self._list_sessions_sync,
            app_name=app_name,
            user_id=user_id
        )

    def _list_sessions_sync(self, app_name: str, user_id: Optional[str] = None) -> ListSessionsResponse:
        self._connect()
        query = {"app_name": app_name}
        if user_id:
            query["user_id"] = user_id
            
        cursor = self._sessions_col.find(query)
        sessions = []
        for doc in cursor:
            sessions.append(Session(
                id=doc["id"],
                app_name=doc["app_name"],
                user_id=doc["user_id"],
                state=doc.get("state", {}),
                last_update_time=doc.get("last_update_time", 0),
                events=[] # List response doesn't include events usually
            ))
            
        return ListSessionsResponse(sessions=sessions)

    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        await asyncio.to_thread(
            self._delete_session_sync,
            app_name=app_name,
            user_id=user_id,
            session_id=session_id
        )

    def _delete_session_sync(self, app_name: str, user_id: str, session_id: str) -> None:
        self._connect()
        self._sessions_col.delete_one({
            "app_name": app_name,
            "user_id": user_id,
            "id": session_id
        })
        self._events_col.delete_many({"session_id": session_id})

    async def append_event(self, session: Session, event: Event) -> Event:
        # First call super to update in-memory session object state
        await super().append_event(session, event)
        
        # Then persist
        await asyncio.to_thread(self._append_event_sync, session, event)
        return event

    def _append_event_sync(self, session: Session, event: Event):
        self._connect()
        
        # 1. Update Session State
        self._sessions_col.update_one(
            {"id": session.id, "app_name": session.app_name, "user_id": session.user_id},
            {"$set": {
                "state": session.state,
                "last_update_time": session.last_update_time
            }}
        )
        
        # 2. Insert Event
        event_doc = event.model_dump(mode="json")
        event_doc["session_id"] = session.id
        self._events_col.insert_one(event_doc)
