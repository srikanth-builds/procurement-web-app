# agents/project_planner/step_tools.py

"""Step tracking tools for workflow progress.

These tools allow agents to emit step events for to-do list tracking.
The frontend can render these as a progress checklist.
"""

import asyncio
from typing import Any, Dict, Optional
from google.adk.tools import FunctionTool
from ag_ui.core import EventType, StepStartedEvent, StepFinishedEvent

import sys

sys.path.insert(0, "/home/srikanth/Work/Angular/angular-tailwind/backend")

from ag_ui_adk_ext import run_context


# Define workflow steps with metadata
WORKFLOW_STEPS = {
    "gather_requirements": {
        "name": "Gather Requirements",
        "description": "Collect project requirements from user",
        "agent": "requirements_analyst",
    },
    "structure_requirements": {
        "name": "Structure Requirements",
        "description": "Organize and validate requirements",
        "agent": "requirements_analyst",
    },
    "create_breakdown": {
        "name": "Create Work Breakdown",
        "description": "Break project into phases and tasks",
        "agent": "task_planner",
    },
    "calculate_timeline": {
        "name": "Calculate Timeline",
        "description": "Determine project schedule and milestones",
        "agent": "task_planner",
    },
    "estimate_resources": {
        "name": "Estimate Resources",
        "description": "Determine team composition and costs",
        "agent": "resource_allocator",
    },
    "analyze_risks": {
        "name": "Analyze Risks",
        "description": "Identify and assess project risks",
        "agent": "resource_allocator",
    },
    "generate_plan": {
        "name": "Generate Plan",
        "description": "Compile final project plan",
        "agent": "resource_allocator",
    },
    "get_approval": {
        "name": "Get Approval",
        "description": "Get user approval for the plan",
        "agent": "project_coordinator",
    },
}


async def start_step(step_id: str) -> Dict[str, Any]:
    """Start a workflow step and emit STEP_STARTED event.

    This emits a step event that the frontend can use to show
    progress in a to-do list format.

    Args:
        step_id: The step identifier. Valid values:
            - gather_requirements
            - structure_requirements
            - create_breakdown
            - calculate_timeline
            - estimate_resources
            - analyze_risks
            - generate_plan
            - get_approval

    Returns:
        Status of the step start
    """
    import logging

    logger = logging.getLogger(__name__)

    ctx = run_context.get()
    logger.debug(f"start_step({step_id}) - run_context.get() returned: {ctx}")

    if not ctx:
        logger.error(
            f"start_step({step_id}) - No RunContext available! Did ExtendedADKAgent.run() set it?"
        )
        return {
            "status": "error",
            "message": "No RunContext available - agent not using ExtendedADKAgent?",
        }

    if not ctx.event_queue:
        logger.error(f"start_step({step_id}) - RunContext has no event_queue!")
        return {"status": "error", "message": "No event queue in RunContext"}

    step_info = WORKFLOW_STEPS.get(step_id)
    if not step_info:
        return {"status": "error", "message": f"Unknown step: {step_id}"}

    # Emit STEP_STARTED event
    event = StepStartedEvent(
        type=EventType.STEP_STARTED,
        step_name=step_info["name"],
    )
    await ctx.event_queue.put(event)

    return {
        "status": "ok",
        "step_id": step_id,
        "step_name": step_info["name"],
        "message": f"Started step: {step_info['name']}",
    }


async def finish_step(step_id: str, result: Optional[str] = None) -> Dict[str, Any]:
    """Finish a workflow step and emit STEP_FINISHED event.

    Call this when a step is complete to update the to-do list.

    Args:
        step_id: The step identifier (same as used in start_step)
        result: Optional result summary for the step

    Returns:
        Status of the step completion
    """
    ctx = run_context.get()
    if not ctx or not ctx.event_queue:
        return {"status": "error", "message": "No event queue available"}

    step_info = WORKFLOW_STEPS.get(step_id)
    if not step_info:
        return {"status": "error", "message": f"Unknown step: {step_id}"}

    # Emit STEP_FINISHED event
    event = StepFinishedEvent(
        type=EventType.STEP_FINISHED,
        step_name=step_info["name"],
    )
    await ctx.event_queue.put(event)

    return {
        "status": "ok",
        "step_id": step_id,
        "step_name": step_info["name"],
        "result": result,
        "message": f"Completed step: {step_info['name']}",
    }


def get_step_tools():
    """Get step tracking tools as FunctionTools."""
    return [
        FunctionTool(func=start_step),
        FunctionTool(func=finish_step),
    ]
