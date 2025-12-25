# agents/project_planner/server.py

"""FastAPI server for the Project Planning Multi-Agent System.

This module sets up the AG-UI compatible endpoint using ExtendedADKAgent.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project_planner directory
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# Fix relative GOOGLE_APPLICATION_CREDENTIALS path
creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if creds_path and not os.path.isabs(creds_path):
    # Convert relative path to absolute based on this file's directory
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
from .coordinator import project_coordinator_agent
from .test_agent import test_agent
from .activity_templates import setup_activity_registry


def create_project_planner_app() -> FastAPI:
    """Create FastAPI app for project planner."""

    app = FastAPI(
        title="Project Planning Multi-Agent System",
        description="AI-powered project planning using Google ADK multi-agent architecture",
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

    # Set up activity registry
    activity_registry = setup_activity_registry()

    # Create extended agent with all features
    agent = ExtendedADKAgent(
        adk_agent=test_agent,
        app_name="project_planner",
        # Activity registry for smart status messages
        activity_registry=activity_registry,
        # Predictive state for real-time UI updates
        predict_state=[
            PredictStateMapping(
                state_key="project_plan",
                tool="update_project_plan",
                tool_argument="plan",
            ),
            PredictStateMapping(
                state_key="project_summary",
                tool="show_project_summary",
                tool_argument="summary",
            ),
        ],
        # Enable session resumability
        enable_resumability=True,
    )

    # Add AG-UI compatible endpoint
    add_adk_fastapi_endpoint(app, agent, path="/api/project-planner")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "agent": "project_planner"}

    return app


# Create app instance
app = create_project_planner_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
