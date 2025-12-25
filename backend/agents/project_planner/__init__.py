# agents/project_planner/__init__.py

"""Project Planning Multi-Agent System.

A demonstration of multi-agent architecture using Google ADK with ag_ui_adk_ext.
This system helps users plan and manage projects by breaking them into tasks,
assigning resources, and tracking progress.

Agents:
- Project Coordinator (root): Orchestrates the planning process
- Requirements Analyst: Gathers and analyzes project requirements
- Task Planner: Breaks down project into tasks and milestones
- Resource Allocator: Suggests team allocation and timeline
- Test Agent: Simple agent for AG-UI feature testing
"""

from .coordinator import project_coordinator_agent
from .requirements import requirements_analyst_agent
from .task_planner import task_planner_agent
from .resource_allocator import resource_allocator_agent
from .test_agent import test_agent
from .tools import get_project_tools
from .activity_templates import setup_activity_registry

__all__ = [
    "project_coordinator_agent",
    "requirements_analyst_agent",
    "task_planner_agent",
    "resource_allocator_agent",
    "test_agent",
    "get_project_tools",
    "setup_activity_registry",
]

