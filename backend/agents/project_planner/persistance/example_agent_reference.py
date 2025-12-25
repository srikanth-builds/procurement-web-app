import os
import logging
from pathlib import Path
from dotenv import load_dotenv
import asyncio

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

from contextlib import asynccontextmanager
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from ag_ui_adk.activity_registry import ActivityRegistry
from google.adk.artifacts.gcs_artifact_service import GcsArtifactService
from google.cloud import storage
from procurement.plugins.gcs_registrar import GcsUriRegistrarPlugin
from procurement.subagents.tools.activities import register_activities

# Google ADK Imports
from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai import types
from google.adk.sessions import InMemorySessionService, VertexAiSessionService
from google.adk.plugins import ReflectAndRetryToolPlugin

# Internal imports
from procurement.gmail_integration import gmail_polling_loop
from procurement.api_endpoints import router as api_router
from procurement.routers.user import router as user_router
from procurement.routers.purchase_requests import router as purchase_requests_router
from procurement.routers.memory import router as memory_router
from procurement.persistence.chat_history_async import AsyncMongoDBChatHistorySaver
from procurement.persistence.middleware_optimized import PersistingADKAgentOptimized
from procurement.plugins.error_recovery import ModelErrorRecoveryPlugin
from procurement.plugins.gmail_plugin import GmailPlugin
from procurement.plugins.intent_validation import IntentValidationPlugin
from procurement.plugins.global_security import GlobalSecurityPlugin
from procurement.plugins.tool_validation_plugin import ToolValidationPlugin
from procurement.plugins.user_preferences_plugin import UserPreferencesPlugin
from procurement.plugins.memory_plugin import MemoryPlugin
from procurement.config.memory_config import create_memory_service, get_memory_config

# Subagents & Tools
from procurement.subagents.buying_support_coordinator import (
    buying_support_coordinator as root_agent,
)
from procurement.config.logging import setup_logging
from procurement.config.agent_names import ROOT_AGENT_NAME

from procurement.test_tavily_server import web_search_agent

logger = setup_logging()

# Global plugin instances (for cache invalidation from API routes)
user_preferences_plugin = UserPreferencesPlugin()

# from phoenix.otel import register

# # Configure the Phoenix tracer
# # Explicitly disable the buggy ADK instrumentation
# os.environ["OTEL_PYTHON_DISABLED_INSTRUMENTATIONS"] = "google_adk,openinference_google_adk"

# tracer_provider = register(
#   project_name="procurement-app", # Default is 'default'
#   auto_instrument=False # Auto-instrument your app based on installed OI dependencies
# )

# # Manually instrument only the safe libraries
# try:
#     from openinference.instrumentation.google_genai import GoogleGenAIInstrumentor
#     GoogleGenAIInstrumentor().instrument(tracer_provider=tracer_provider)
#     logger.info("✅ GoogleGenAI instrumentation enabled")
# except ImportError:
#     logger.warning("⚠️ GoogleGenAI instrumentation not found")
# except Exception as e:
#     logger.warning(f"⚠️ Failed to instrument GoogleGenAI: {e}")

# ============================================================================
# Environment Configuration
# ============================================================================
if os.getenv("GOOGLE_CLOUD_PROJECT"):
    if "GOOGLE_API_KEY" in os.environ:
        logger.warning(
            "⚠️ Removing GOOGLE_API_KEY from environment to prevent Vertex AI conflict"
        )
        del os.environ["GOOGLE_API_KEY"]
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "true"


# ============================================================================
# Session Service Configuration
# ============================================================================
def create_session_service():
    # 1. MongoDB (Preferred if configured)
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DATABASE", "adk_sessions")
    if mongo_uri:
        from procurement.persistence.session_service import MongoDBSessionService

        logger.info(f"💾 Using MongoDBSessionService ({db_name})")
        return MongoDBSessionService(mongo_uri=mongo_uri, db_name=db_name)

    # 2. Vertex AI (Fallback for Agent Engine)
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    engine_id = os.getenv("REASONING_ENGINE_ID")

    if project_id and engine_id:
        logger.info(f"💾 Using VertexAiSessionService (Engine ID: {engine_id})")
        return VertexAiSessionService(
            project=project_id, location=location, agent_engine_id=engine_id
        )

    # 3. In-Memory (Fallback)
    logger.warning("⚠️ No persistence configured. Using InMemorySessionService.")
    return InMemorySessionService()


# Initialize global session service
global_session_service = create_session_service()

# Initialize memory service (VertexAI Memory Bank for production)
memory_config = get_memory_config()
global_memory_service = create_memory_service(memory_config)
logger.info(f"🧠 Memory service initialized: {type(global_memory_service).__name__}")

# ============================================================================
# Create the root ADK agent
# ============================================================================
logger.info("=" * 80)
logger.info("Starting Procurement Agent with Intent Validation Plugin")
logger.info("=" * 80)

# root_agent is imported from procurement.subagents.buying_support_coordinator

# Plugin factory - lazy load
_intent_validator = None


def get_intent_validator():
    global _intent_validator
    if _intent_validator is None:
        logger.info("🔧 Creating IntentValidationPlugin (lazy initialization)")
        _intent_validator = IntentValidationPlugin(
            validator_model="gemini-2.0-flash-lite",
            timeout_seconds=5.0,
            fail_open=False,
        )
    return _intent_validator


# Global Agent Instance (for Middleware/Local use)
_adk_agent_instance: ADKAgent = None


def get_adk_agent_instance():
    return _adk_agent_instance


@asynccontextmanager
async def create_app_lifespan(app: FastAPI):
    """Proper async context manager for app lifecycle"""
    global _adk_agent_instance

    print("=" * 60)
    print("🚀 APPLICATION STARTUP")
    print("=" * 60)

    polling_task = None

    try:
        # Initialize GCS Artifact Service
        # Ensure GCS_BUCKET_NAME is set in environment or config
        bucket_name = os.getenv(
            "GCS_BUCKET_NAME", "autonomous-procurement-artifacts"
        )  # Fallback or error
        if bucket_name and bucket_name.startswith("gs://"):
            bucket_name = bucket_name[5:]

        storage_client = storage.Client()
        gcs_artifact_service = GcsArtifactService(bucket_name=bucket_name)

        # Initialize Plugins
        gcs_registrar_plugin = GcsUriRegistrarPlugin(
            name="gcs_registrar_plugin", gcs_artifact_service=gcs_artifact_service
        )

        # Initialize Activity Registry
        activity_registry = ActivityRegistry()

        # Register Tool Activities
        register_activities(activity_registry)

        # Initialize the ADK agent wrapper
        # Note: We use the same session service as root_agent (global_session_service)
        _adk_agent_instance = ADKAgent(
            adk_agent=root_agent,
            app_name="procurement_buying_support_agent",
            user_id="EMP-2024-001",
            session_timeout_seconds=9600,
            tool_timeout_seconds=3600,
            cleanup_interval_seconds=600,
            use_in_memory_services=False,
            session_service=global_session_service,
            memory_service=global_memory_service,  # VertexAI Memory Bank
            activity_registry=activity_registry,
            plugins=[
                GlobalSecurityPlugin(),
                user_preferences_plugin,  # Global instance for cache invalidation
                MemoryPlugin(config=memory_config),  # Memory integration plugin
                ToolValidationPlugin(),
                ModelErrorRecoveryPlugin(),
                GmailPlugin(),
                gcs_registrar_plugin,
                ReflectAndRetryToolPlugin(
                    name="reflect_and_retry_tool_plugin",
                    max_retries=2,
                    throw_exception_if_retry_exceeded=False,
                ),
            ],
        )

        # Initialize Chat History Saver (MongoDB) - Using async optimized version
        # This is for the chat history UI, separate from Agent State
        saver = AsyncMongoDBChatHistorySaver()
        _adk_agent_instance = PersistingADKAgentOptimized(
            _adk_agent_instance,
            saver,
            batch_size=10,  # Flush every 10 events
            flush_interval_ms=500,  # Or every 500ms
        )

        print("✅ ADK Agent initialized")
        print("=" * 60)

        # Start Gmail Polling
        # Currently disabled
        # polling_task = asyncio.create_task(gmail_polling_loop(get_adk_agent_instance))

    except Exception as e:
        print(f"❌ STARTUP FAILED: {e}")
        import traceback

        traceback.print_exc()
        raise

    yield

    print("=" * 60)
    print("🛑 APPLICATION SHUTDOWN")
    print("=" * 60)

    # if polling_task:
    #     polling_task.cancel()
    #     try:
    #         await polling_task
    #     except asyncio.CancelledError:
    #         pass

    try:
        await asyncio.sleep(0.5)
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"⚠️ Error during cleanup: {e}")

    print("=" * 60)


# Create the app with lifespan
app = FastAPI(
    title="ADK Middleware Sample Agent",
    description="Procurement Buying Support Agent",
    version="1.0.0",
    lifespan=create_app_lifespan,
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://localhost:8000",
        "https://procurement-web-app-rvc4.vercel.app/",
        "*",
    ],
    allow_origin_regex=r"https://procurement-web-app.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)
app.include_router(user_router)
app.include_router(purchase_requests_router)
app.include_router(memory_router)


# Health endpoint
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agent_ready": _adk_agent_instance is not None,
    }


# Add ADK endpoint
class ADKAgentProxy:
    """Proxy that lazily gets the agent instance"""

    def __init__(self, getter_func):
        self.getter_func = getter_func

    def __getattr__(self, name):
        agent = self.getter_func()
        if agent is None:
            raise RuntimeError("ADK Agent not initialized")
        return getattr(agent, name)

    async def run(self, input_data):
        agent = self.getter_func()
        if agent is None:
            raise RuntimeError("ADK Agent not initialized")
        async for event in agent.run(input_data):
            yield event


agent_proxy = ADKAgentProxy(get_adk_agent_instance)
add_adk_fastapi_endpoint(app, agent_proxy, path="/")
