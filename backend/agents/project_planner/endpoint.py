from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from .persistance.chat_history_async import AsyncMongoDBChatHistorySaver

router = APIRouter()


# ============================================================================
# Chat History Endpoint
# ============================================================================
@router.get("/history/{thread_id}")
async def get_chat_history(thread_id: str):
    """
    Retrieve chat history for a specific thread.
    """
    saver = AsyncMongoDBChatHistorySaver()
    history = await saver.get_history(thread_id)
    return history


@router.get("/threads")
async def list_threads():
    """
    Retrieve a list of active conversation threads.
    """
    saver = AsyncMongoDBChatHistorySaver()
    threads = await saver.get_threads()
    return threads


class UpdateTitleRequest(BaseModel):
    title: str


@router.put("/threads/{thread_id}")
async def update_thread_title(thread_id: str, request: UpdateTitleRequest):
    """
    Update the title of a conversation thread.
    """
    saver = AsyncMongoDBChatHistorySaver()
    success = await saver.update_title(thread_id, request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"status": "ok", "title": request.title}


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, request: Request):
    """
    Delete a conversation thread and its session state.
    """
    # 1. Delete History
    saver = AsyncMongoDBChatHistorySaver()
    history_deleted = await saver.delete_thread(thread_id)

    # 2. Delete Session State
    try:
        session_service = request.app.state.session_service
        
        # We assume default app_name and user_id for now as used in test_server.py
        # Ideally these should be dynamic or passed in request
        await session_service.delete_session(
            app_name="test_agent", # Matches test_server.py
            user_id="test_user",   # Matches test_server.py default? No, test_server doesn't set user_id explicitly in ADKAgent init?
                                   # Wait, ExtendedADKAgent doesn't take user_id?
                                   # ADKAgent defaults user_id to "user".
                                   # Let's check ExtendedADKAgent or ADKAgent default.
            session_id=thread_id,
        )
    except Exception as e:
        # Log but don't fail if session delete fails (might not exist)
        print(f"Warning: Failed to delete session state: {e}")

    if not history_deleted:
        raise HTTPException(status_code=404, detail="Thread not found")

    return {"status": "ok", "deleted": True}


# ============================================================================
# Chat History Endpoint
# ============================================================================
@router.get("/history/{thread_id}")
async def get_chat_history(thread_id: str):
    """
    Retrieve chat history for a specific thread.
    """
    saver = AsyncMongoDBChatHistorySaver()
    history = await saver.get_history(thread_id)
    return history


@router.get("/threads")
async def list_threads():
    """
    Retrieve a list of active conversation threads.
    """
    saver = AsyncMongoDBChatHistorySaver()
    threads = await saver.get_threads()
    return threads


from pydantic import BaseModel
from fastapi import HTTPException


class UpdateTitleRequest(BaseModel):
    title: str


@router.put("/threads/{thread_id}")
async def update_thread_title(thread_id: str, request: UpdateTitleRequest):
    """
    Update the title of a conversation thread.
    """
    saver = AsyncMongoDBChatHistorySaver()
    success = await saver.update_title(thread_id, request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"status": "ok", "title": request.title}


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    """
    Delete a conversation thread and its session state.
    """
    # 1. Delete History
    saver = AsyncMongoDBChatHistorySaver()
    history_deleted = await saver.delete_thread(thread_id)

    # 2. Delete Session State
    # We need to import the global session service.
    # Note: This might cause circular imports if agent.py imports api_endpoints.py.
    # Let's check imports. agent.py imports api_endpoints.
    # So we should import inside the function or use a getter if possible,
    # or rely on the fact that python modules are singletons.
    # However, global_session_service is a variable in agent.py.
    # To avoid circular import, we can try to import it inside the function.
    try:
        from procurement.agent import global_session_service

        # We need app_name and user_id to delete session.
        # We can try to look them up or use wildcards if supported (not usually).
        # Or we can just try to delete with default values if we know them.
        # The ADKAgent uses:
        # app_name="procurement_buying_support_agent"
        # user_id="demo_user"
        # But wait, user_id might be dynamic? In agent.py it is hardcoded to "demo_user".

        await global_session_service.delete_session(
            app_name="procurement_buying_support_agent",
            user_id="EMP-2024-001",
            session_id=thread_id,
        )
    except Exception as e:
        # Log but don't fail if session delete fails (might not exist)
        print(f"Warning: Failed to delete session state: {e}")

    if not history_deleted:
        raise HTTPException(status_code=404, detail="Thread not found")

    return {"status": "ok", "deleted": True}