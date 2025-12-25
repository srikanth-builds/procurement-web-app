import asyncio
import os
import time
from google.adk.events import Event
from google.genai import types
from agents.project_planner.persistance.session_service import MongoDBSessionService

# Mock env
os.environ["MONGODB_URI"] = "mongodb+srv://admin:admin@testing.1zjhqwv.mongodb.net/?appName=testing&retryWrites=true&w=majority"
os.environ["MONGODB_DATABASE"] = "project_planner_db"

async def test_persistence():
    print("Testing persistence...")
    service = MongoDBSessionService(
        mongo_uri=os.environ["MONGODB_URI"],
        db_name=os.environ["MONGODB_DATABASE"]
    )
    
    session_id = "test-persistence-debug-1"
    app_name = "test-app"
    user_id = "test-user"
    
    # 1. Create Session
    print(f"Creating session {session_id}...")
    try:
        await service.delete_session(app_name=app_name, user_id=user_id, session_id=session_id)
    except:
        pass
        
    session = await service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id
    )
    print("Session created.")
    
    # 2. Create Event with Content (simulating user message)
    content = types.Content(
        role="user",
        parts=[types.Part(text="Hello, this is a test message.")]
    )
    
    event = Event(
        author="user",
        content=content,
        timestamp=time.time()
    )
    
    # 3. Append Event
    print("Appending event...")
    await service.append_event(session, event)
    print("Event appended.")
    
    # 4. Load Session
    print("Loading session...")
    loaded_session = await service.get_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id
    )
    
    if loaded_session and loaded_session.events:
        print(f"Loaded {len(loaded_session.events)} events.")
        print(f"Event 0 content: {loaded_session.events[0].content}")
        
        # Verify content
        parts = loaded_session.events[0].content.parts
        if parts and parts[0].text == "Hello, this is a test message.":
            print("✅ Persistence SUCCESS: Content matches.")
        else:
            print("❌ Persistence FAILURE: Content mismatch.")
    else:
        print("❌ Persistence FAILURE: No events loaded.")

if __name__ == "__main__":
    asyncio.run(test_persistence())
