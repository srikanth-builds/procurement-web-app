# agents/project_planner/test_agent.py

"""Simple Test Agent for AG-UI Feature Verification.

This agent is designed for quick testing of AG-UI features without
complex multi-turn conversations or multi-agent handoffs.
"""

import sys
import asyncio
sys.path.insert(0, "/home/srikanth/Work/Angular/angular-tailwind/backend")

from typing import Dict, Any, Optional, List
from google.adk import Agent
from google.adk.tools import FunctionTool, ToolContext
from .step_tools import get_step_tools
from ag_ui_adk_ext import FrontendToolSet, ActivityRegistry


# =============================================================================
# Backend Tools (matching frontend tool-render-demo.component.ts)
# =============================================================================

async def calculate_project_timeline(
    project_name: str,
    duration_weeks: int = 12,
    start_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Calculate project timeline and milestones.
    
    Args:
        project_name: Name of the project
        duration_weeks: Total project duration in weeks
        start_date: Optional start date (YYYY-MM-DD format)
        
    Returns:
        Project timeline with milestones
    """
    from datetime import datetime, timedelta
    
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now()
    
    milestones = [
        {"name": "Project Kickoff", "week": 1, "date": (start + timedelta(weeks=1)).strftime("%Y-%m-%d")},
        {"name": "Requirements Complete", "week": 2, "date": (start + timedelta(weeks=2)).strftime("%Y-%m-%d")},
        {"name": "Design Complete", "week": 4, "date": (start + timedelta(weeks=4)).strftime("%Y-%m-%d")},
        {"name": "Development Complete", "week": duration_weeks - 3, "date": (start + timedelta(weeks=duration_weeks-3)).strftime("%Y-%m-%d")},
        {"name": "Testing Complete", "week": duration_weeks - 1, "date": (start + timedelta(weeks=duration_weeks-1)).strftime("%Y-%m-%d")},
        {"name": "Project Launch", "week": duration_weeks, "date": (start + timedelta(weeks=duration_weeks)).strftime("%Y-%m-%d")},
    ]
    
    await asyncio.sleep(4)
    
    return {
        "project_name": project_name,
        "duration_weeks": duration_weeks,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": (start + timedelta(weeks=duration_weeks)).strftime("%Y-%m-%d"),
        "milestones": milestones,
    }


async def estimate_resources(
    team_type: str = "standard",
    project_complexity: str = "medium",
) -> Dict[str, Any]:
    """Estimate team resources needed for the project.
    
    Args:
        team_type: Type of team (minimal, standard, extended)
        project_complexity: Complexity level (low, medium, high)
        
    Returns:
        Resource estimation with team composition
    """
    team_configs = {
        "minimal": {
            "team_size": 3,
            "roles": ["Project Manager", "Full-Stack Developer", "QA Engineer"],
            "monthly_cost": 25000,
        },
        "standard": {
            "team_size": 6,
            "roles": ["Project Manager", "Tech Lead", "Frontend Dev", "Backend Dev", "QA Engineer", "DevOps"],
            "monthly_cost": 50000,
        },
        "extended": {
            "team_size": 10,
            "roles": ["Project Manager", "Tech Lead", "2x Frontend Dev", "2x Backend Dev", "2x QA Engineer", "DevOps", "UX Designer"],
            "monthly_cost": 85000,
        },
    }
    
    config = team_configs.get(team_type, team_configs["standard"])
    complexity_multiplier = {"low": 0.8, "medium": 1.0, "high": 1.3}.get(project_complexity, 1.0)
    
    await asyncio.sleep(4)
    
    return {
        "team_type": team_type,
        "project_complexity": project_complexity,
        "team_size": config["team_size"],
        "roles": config["roles"],
        "estimated_monthly_cost": int(config["monthly_cost"] * complexity_multiplier),
        "recommendation": f"A {team_type} team is suitable for {project_complexity} complexity projects.",
    }


async def create_task_breakdown(
    project_name: str = "Unnamed Project",
    num_phases: int = 4,
) -> Dict[str, Any]:
    """Create work breakdown structure for the project.
    
    Args:
        project_name: Name of the project
        num_phases: Number of phases to break into
        
    Returns:
        Work breakdown structure with phases and tasks
    """
    phases = [
        {
            "phase": "Planning",
            "tasks": ["Requirements gathering", "Stakeholder interviews", "Scope definition", "Risk assessment"],
            "duration_weeks": 2,
        },
        {
            "phase": "Design",
            "tasks": ["Architecture design", "UI/UX wireframes", "Database schema", "API contracts"],
            "duration_weeks": 2,
        },
        {
            "phase": "Development",
            "tasks": ["Frontend development", "Backend development", "Integration", "Code review"],
            "duration_weeks": 6,
        },
        {
            "phase": "Testing & Launch",
            "tasks": ["Unit testing", "Integration testing", "UAT", "Deployment", "Documentation"],
            "duration_weeks": 2,
        },
    ]
    
    await asyncio.sleep(4)
    
    return {
        "project_name": project_name,
        "total_phases": min(num_phases, len(phases)),
        "phases": phases[:num_phases],
        "total_tasks": sum(len(p["tasks"]) for p in phases[:num_phases]),
        "estimated_duration_weeks": sum(p["duration_weeks"] for p in phases[:num_phases]),
    }


async def analyze_project_risks(
    project_name: str = "Unnamed Project",
    risk_categories: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Analyze potential project risks.
    
    Args:
        project_name: Name of the project
        risk_categories: Categories to analyze (technical, schedule, resource, scope)
        
    Returns:
        Risk analysis with mitigation strategies
    """
    categories = risk_categories or ["technical", "schedule", "resource", "scope"]
    
    risk_data = {
        "technical": {
            "risk": "Technical complexity or unfamiliar technology",
            "probability": "Medium",
            "impact": "High",
            "mitigation": "Conduct POC early, allocate time for learning curve",
        },
        "schedule": {
            "risk": "Timeline slippage due to unforeseen issues",
            "probability": "High",
            "impact": "Medium",
            "mitigation": "Add 20% buffer, prioritize critical path items",
        },
        "resource": {
            "risk": "Key personnel unavailability",
            "probability": "Low",
            "impact": "High",
            "mitigation": "Cross-train team members, document knowledge",
        },
        "scope": {
            "risk": "Scope creep from changing requirements",
            "probability": "High",
            "impact": "High",
            "mitigation": "Implement change control process, clear sign-off",
        },
    }
    
    analyzed_risks = [
        {"category": cat, **risk_data[cat]}
        for cat in categories
        if cat in risk_data
    ]
    
    return {
        "project_name": project_name,
        "risks_analyzed": len(analyzed_risks),
        "risks": analyzed_risks,
        "overall_risk_level": "Medium-High" if len([r for r in analyzed_risks if r["impact"] == "High"]) > 1 else "Medium",
    }


async def greet_user(name: str) -> str:
    """Greet the user.
    
    Args:
        name: Name of the user
        
    Returns:
        Greeting message
    """
    await asyncio.sleep(2)
    return f"Hello, {name}!"


async def process_order(order_id: str) -> str:
    """Process an order.
    
    Args:
        order_id: The ID of the order
        
    Returns:
        Confirmation message
    """
    await asyncio.sleep(2)
    return f"Order {order_id} processed successfully."


async def set_user_role(role: str, tool_context: ToolContext) -> str:
    """Set the user role in session state.
    
    Args:
        role: The user role (e.g., 'admin', 'viewer')
        tool_context: The tool context (injected by ADK)
        
    Returns:
        Confirmation message
    """
    if tool_context:
        tool_context.state["user_role"] = role + " (context available)"
        return f"User role set to {role} in session state"

    await asyncio.sleep(2)
    
    return f"User role {role} (context not available)"


# =============================================================================
# Activity Registry for Tool Renders
# =============================================================================

def setup_test_activity_registry() -> ActivityRegistry:
    """Set up activity registry for test agent tools."""
    registry = ActivityRegistry()
    
    # Timeline Tool
    registry.register(
        "calculate_project_timeline",
        running_template="📅 Calculating timeline for {project_name}...",
        completed_template="✅ Timeline ready: {duration_weeks} weeks",
        failure_template="❌ Failed to calculate timeline: {error}",
    )
    
    # Resource Estimation Tool
    registry.register(
        "estimate_resources",
        running_template="👥 Estimating resources ({team_type} team)...",
        completed_template="✅ Resource estimate: {team_size} team members",
        failure_template="❌ Resource estimation failed: {error}",
    )
    
    # Task Breakdown Tool
    registry.register(
        "create_task_breakdown",
        running_template="📋 Creating work breakdown for {project_name}...",
        completed_template="✅ Created {total_tasks} tasks in {total_phases} phases",
        failure_template="❌ Task breakdown failed: {error}",
    )
    
    # Risk Analysis Tool
    registry.register(
        "analyze_project_risks",
        running_template="⚠️ Analyzing risks for {project_name}...",
        completed_template="✅ Identified {risks_analyzed} risks ({overall_risk_level})",
        failure_template="❌ Risk analysis failed: {error}",
    )

    # Greet User Tool (Session Key Injection Demo)
    registry.register(
        "greet_user",
        running_template="👋 Greeting {name} (Role: {user_role})...",
        completed_template="✅ Greeted {name}",
        inject_state_keys=["user_role"],
    )

    # Process Order Tool (Tool Arg in Completed Template Demo)
    registry.register(
        "process_order",
        running_template="📦 Processing order {order_id}...",
        completed_template="✅ Order {order_id} processed",
        failure_template="❌ Failed to process order {order_id}: {error}",
    )
    
    registry.register(
        "set_user_role",
        running_template="🔄 Setting user role to {role}...",
        completed_template="✅ User role set to {user_role}",
        inject_state_keys=["user_role"],
    )

    # Step Tools
    registry.register(
        "start_step",
        running_template="🔄 Starting step: {step_id}...",
        completed_template="✅ Step started: {step_name}",
    )
    
    registry.register(
        "finish_step",
        running_template="🔄 Completing step: {step_id}...",
        completed_template="✅ Step completed: {step_name}",
    )
    
    return registry


# =============================================================================
# Test Agent Definition
# =============================================================================

TEST_AGENT_INSTRUCTION = """You are a Project Planning Test Agent.

## Your Purpose
You help test AG-UI features by immediately using tools when requested.
Do NOT ask clarifying questions - just execute with sensible defaults.

## Available Tools & When to Use Them:
- "timeline" or "schedule" → Use `calculate_project_timeline` (args: project_name, duration_weeks)
- "resources" or "team" → Use `estimate_resources` (args: team_type, project_complexity)
- "tasks" or "breakdown" → Use `create_task_breakdown` (args: project_name, num_phases)
- "risks" or "analyze" → Use `analyze_project_risks` (args: project_name, risk_categories)
- "greet" → Use `greet_user` (args: name)
- "order" → Use `process_order` (args: order_id)
- "step" or "steps" → Demonstrate step tracking with start_step/finish_step
- "all" or "demo" → Run ALL four tools in sequence to demo the UI

## Step Tracking Demo
When testing steps, use this pattern (ALL in ONE response):
1. start_step("create_breakdown")
2. create_task_breakdown(...)
3. finish_step("create_breakdown")

## Important Rules
1. NEVER ask questions - always use sensible defaults
2. When using steps: start_step → tool → finish_step (same turn)
3. Be concise - no lengthy explanations
4. If user says a project name, use it; otherwise use "Demo Project"

## Example Interactions:
- User: "timeline" → call calculate_project_timeline(project_name="Demo Project", duration_weeks=12)
- User:  "greet Alice" → call greet_user(name="Alice")
- User: "order 123" → call process_order(order_id="123")
- User: "team minimal" → call estimate_resources(team_type="minimal")
- User: "all" → call Run all 4 tools in sequence

## Important Rule 
dont ask user for any input if he mentions tool name just look on input parameter write up own data and call it
"""


test_agent = Agent(
    name="test_agent",
    model="gemini-2.0-flash-exp",
    instruction=TEST_AGENT_INSTRUCTION,
    description="Simple test agent for verifying AG-UI features",
    tools=[
        # Backend tools (matching frontend tool-render-demo.component.ts)
        FunctionTool(func=calculate_project_timeline),
        FunctionTool(func=estimate_resources),
        FunctionTool(func=create_task_breakdown),
        FunctionTool(func=analyze_project_risks),
        FunctionTool(func=greet_user),
        FunctionTool(func=process_order),
        FunctionTool(func=set_user_role),
        # Step tracking
        *get_step_tools(),
        # Frontend tools
        FrontendToolSet({
            "update_project_plan": {"summarize_response": False},
            "show_project_summary": {"summarize_response": False},
            "ask_user_confirmation": {"summarize_response": True},
            "update_pr_state": {"summarize_response": False},
            "supplier_list": {"summarize_response": False},
            "show_products_to_user": {"summarize_response": False},
            "show_suggestions": {"summarize_response": False},
        }),
    ],
)


# Export the registry setup function
__all__ = ["test_agent", "setup_test_activity_registry"]
