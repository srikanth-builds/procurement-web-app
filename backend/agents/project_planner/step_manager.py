# agents/project_planner/step_manager.py

"""Step Manager for emitting workflow step events.

This module provides utilities to emit STEP_STARTED and STEP_FINISHED events
for tracking workflow progress as a to-do list in the frontend.
"""

import asyncio
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from ag_ui.core import EventType, StepStartedEvent, StepFinishedEvent


class StepManager:
    """Manages workflow step events for to-do list tracking.

    This class emits STEP_STARTED and STEP_FINISHED events that the frontend
    can use to render a to-do list with progress indicators.

    Steps for Project Planning workflow:
    1. gather_requirements - Gather project requirements
    2. structure_requirements - Structure and validate requirements
    3. create_breakdown - Create work breakdown structure
    4. calculate_timeline - Calculate project timeline
    5. estimate_resources - Estimate team and resources
    6. analyze_risks - Analyze project risks
    7. generate_plan - Generate final project plan
    8. get_approval - Get user approval
    """

    # Define the workflow steps with display names
    WORKFLOW_STEPS = {
        "gather_requirements": "Gather Requirements",
        "structure_requirements": "Structure Requirements",
        "create_breakdown": "Create Work Breakdown",
        "calculate_timeline": "Calculate Timeline",
        "estimate_resources": "Estimate Resources",
        "analyze_risks": "Analyze Risks",
        "generate_plan": "Generate Project Plan",
        "get_approval": "Get User Approval",
    }

    def __init__(self, event_queue: asyncio.Queue):
        """Initialize the step manager.

        Args:
            event_queue: Queue to emit events to
        """
        self.event_queue = event_queue
        self.completed_steps: set = set()
        self.current_step: Optional[str] = None

    async def start_step(self, step_name: str) -> None:
        """Emit STEP_STARTED event.

        Args:
            step_name: Name of the step being started
        """
        # Close any previous step
        if self.current_step and self.current_step != step_name:
            await self.finish_step(self.current_step)

        self.current_step = step_name

        # Get display name
        display_name = self.WORKFLOW_STEPS.get(step_name, step_name)

        event = StepStartedEvent(
            type=EventType.STEP_STARTED,
            step_name=display_name,
        )
        await self.event_queue.put(event)

    async def finish_step(self, step_name: str) -> None:
        """Emit STEP_FINISHED event.

        Args:
            step_name: Name of the step being finished
        """
        # Get display name
        display_name = self.WORKFLOW_STEPS.get(step_name, step_name)

        event = StepFinishedEvent(
            type=EventType.STEP_FINISHED,
            step_name=display_name,
        )
        await self.event_queue.put(event)

        self.completed_steps.add(step_name)
        if self.current_step == step_name:
            self.current_step = None

    @asynccontextmanager
    async def step(self, step_name: str):
        """Context manager for step execution.

        Usage:
            async with step_manager.step("gather_requirements"):
                # Do step work
                ...
        """
        await self.start_step(step_name)
        try:
            yield
        finally:
            await self.finish_step(step_name)

    def get_progress(self) -> Dict[str, Any]:
        """Get current workflow progress.

        Returns:
            Dict with completed steps, current step, and progress percentage
        """
        total = len(self.WORKFLOW_STEPS)
        completed = len(self.completed_steps)

        return {
            "completed_steps": list(self.completed_steps),
            "current_step": self.current_step,
            "total_steps": total,
            "completed_count": completed,
            "progress_percentage": (completed / total) * 100 if total > 0 else 0,
        }


# Workflow step definitions for agents to use
REQUIREMENTS_STEPS = ["gather_requirements", "structure_requirements"]
TASK_PLANNING_STEPS = ["create_breakdown", "calculate_timeline"]
RESOURCE_STEPS = ["estimate_resources", "analyze_risks", "generate_plan"]
APPROVAL_STEPS = ["get_approval"]
