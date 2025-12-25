# agents/project_planner/test_server.py

"""Simple test server for AG-UI feature verification."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project_planner directory
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# Fix relative GOOGLE_APPLICATION_CREDENTIALS path
creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if creds_path and not os.path.isabs(creds_path):
    abs_creds_path = str(Path(__file__).parent / creds_path)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_creds_path


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sys
sys.path.insert(0, "/home/srikanth/Work/Angular/angular-tailwind/backend")

from ag_ui_adk_ext import (
    ExtendedADKAgent,
    PredictStateMapping,
    add_adk_fastapi_endpoint,
)
from .test_agent import test_agent, setup_test_activity_registry
from .persistance.session_service import MongoDBSessionService
from .persistance.chat_history_async import AsyncMongoDBChatHistorySaver
from .persistance.middleware_optimized import PersistingADKAgentOptimized
from google.adk.sessions import InMemorySessionService
from .endpoint import router as history_router
from .endpoint import router as api_router


def create_test_app() -> FastAPI:
    """Create FastAPI app for test agent."""

    app = FastAPI(
        title="AG-UI Test Agent",
        description="Simple agent for testing AG-UI features",
        version="1.0.0",
    )

    # CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    # Set up activity registry with test tools
    activity_registry = setup_test_activity_registry()

    # Configure Session Service
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DATABASE", "test_agent_db")
    
    if mongo_uri:
        session_service = MongoDBSessionService(mongo_uri=mongo_uri, db_name=db_name)
        print(f"💾 Using MongoDBSessionService ({db_name})")
    else:
        session_service = InMemorySessionService()
        print("⚠️ No MONGODB_URI found. Using InMemorySessionService.")

    # Create extended agent
    agent = ExtendedADKAgent(
        adk_agent=test_agent,
        app_name="test_agent",
        activity_registry=activity_registry,
        predict_state=[
            PredictStateMapping(
                state_key="project_plan",
                tool="update_project_plan",
                tool_argument="plan",
            ),
        ],
        enable_resumability=True,
        session_service=session_service,
    )

    # Assign session service to app state
    app.state.session_service = session_service

    # Wrap with Persistence Middleware (if Mongo is available)
    if mongo_uri:
        saver = AsyncMongoDBChatHistorySaver(mongo_uri=mongo_uri, db_name=db_name)
        # Note: PersistingADKAgentOptimized expects an ADKAgent, and ExtendedADKAgent IS an ADKAgent
        agent = PersistingADKAgentOptimized(
            agent=agent,
            saver=saver,
            batch_size=5,
            flush_interval_ms=500
        )
        print("✅ Persistence middleware enabled")

    # Add AG-UI endpoint
    add_adk_fastapi_endpoint(app, agent, path="/api/project-planner")

    # Include History Router
    app.include_router(history_router, prefix="/api/project-planner")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "agent": "test_agent"}

    return app


# Create app instance
app = create_test_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

