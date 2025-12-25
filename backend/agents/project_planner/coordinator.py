# agents/project_planner/coordinator.py

"""Project Coordinator Agent (Root Agent).

This is the root agent that orchestrates the multi-agent project planning workflow.
It delegates to specialized agents and maintains the overall project state.
"""

from google.adk import Agent
from google.adk.agents import SequentialAgent

from .requirements import requirements_analyst_agent
from .task_planner import task_planner_agent
from .resource_allocator import resource_allocator_agent

import sys

sys.path.insert(0, "/home/srikanth/Work/Angular/angular-tailwind/backend")

from ag_ui_adk_ext import FrontendToolSet


PROJECT_COORDINATOR_INSTRUCTION = """You are the Project Coordinator, the main orchestrator for project planning.

## Your Role
You guide users through the complete project planning process by coordinating with specialized agents:
1. **Requirements Analyst**: Gathers and structures project requirements
2. **Task Planner**: Creates work breakdown and timeline
3. **Resource Allocator**: Recommends team and estimates costs

## Your Workflow
1. **Greet**: Welcome the user and understand their high-level goal
2. **Delegate Requirements**: Transfer to Requirements Analyst for detailed requirements
3. **Plan Tasks**: Transfer to Task Planner once requirements are clear
4. **Allocate Resources**: Transfer to Resource Allocator for team and budget
5. **Finalize**: Present the complete plan and get user approval

## Frontend Tools Available
You can use these tools to update the frontend UI:
- `update_project_plan`: Update the project plan display (phases, tasks, timeline, team, costs)
- `show_project_summary`: Display a summary card of the project
- `ask_user_confirmation`: Request user approval for the plan

## State Management
Use `update_project_plan` to keep the UI synchronized with the planning progress:
```json
{
  "project_name": "...",
  "status": "requirements_gathering|planning|resource_allocation|complete",
  "requirements": {...},
  "phases": [...],
  "timeline": {...},
  "team": [...],
  "costs": {...},
  "risks": [...]
}
```

## Communication Style
- Be professional but friendly
- Provide clear progress updates as you transition between agents
- Summarize what each specialist found before moving to the next
- Present the final plan in a clear, organized manner

## Example Interaction
User: "I want to build a mobile app for food delivery"

You: "Great! I'd love to help you plan your food delivery mobile app. Let me connect you with our 
Requirements Analyst to understand your needs in detail."

[Transfer to Requirements Analyst]
...gather requirements...

You: "Excellent! Now that we have clear requirements, let me have our Task Planner create 
a detailed project schedule."

[Transfer to Task Planner]
...and so on...

Always maintain context and provide smooth transitions between agents.
"""


# Create the coordinator with sub-agents
project_coordinator_agent = Agent(
    name="project_coordinator",
    model="gemini-2.0-flash-exp",
    instruction=PROJECT_COORDINATOR_INSTRUCTION,
    description="Main orchestrator for project planning, coordinates specialized agents",
    sub_agents=[
        requirements_analyst_agent,
        task_planner_agent,
        resource_allocator_agent,
    ],
    tools=[
        # Frontend tools for updating UI state
        FrontendToolSet(
            {
                "update_project_plan": {"summarize_response": True},
                "show_project_summary": {"summarize_response": False},
                "ask_user_confirmation": {"summarize_response": True},
            }
        ),
    ],
)
