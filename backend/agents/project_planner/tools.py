# agents/project_planner/tools.py

"""Tools for the Project Planning Multi-Agent System.

These are backend tools that the agents can use to perform actions.
Frontend tools are provided via FrontendToolSet.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from google.adk.tools import FunctionTool
import json


def calculate_project_timeline(
    start_date: str, tasks: List[Dict[str, Any]], buffer_days: int = 5
) -> Dict[str, Any]:
    """Calculate project timeline based on tasks and dependencies.

    Args:
        start_date: Project start date in YYYY-MM-DD format
        tasks: List of task dicts with name, duration_days, and dependencies
        buffer_days: Buffer days to add for risk mitigation

    Returns:
        Timeline with start/end dates for each task and project
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        timeline = []
        task_end_dates = {}

        for task in tasks:
            task_name = task.get("name", "Unnamed Task")
            duration = task.get("duration_days", 1)
            dependencies = task.get("dependencies", [])

            # Calculate task start based on dependencies
            task_start = start
            for dep in dependencies:
                if dep in task_end_dates:
                    if task_end_dates[dep] > task_start:
                        task_start = task_end_dates[dep] + timedelta(days=1)

            task_end = task_start + timedelta(days=duration - 1)
            task_end_dates[task_name] = task_end

            timeline.append(
                {
                    "task": task_name,
                    "start_date": task_start.strftime("%Y-%m-%d"),
                    "end_date": task_end.strftime("%Y-%m-%d"),
                    "duration_days": duration,
                }
            )

        # Calculate project end date with buffer
        if task_end_dates:
            project_end = max(task_end_dates.values()) + timedelta(days=buffer_days)
        else:
            project_end = start

        return {
            "project_start": start_date,
            "project_end": project_end.strftime("%Y-%m-%d"),
            "total_duration_days": (project_end - start).days + 1,
            "buffer_days": buffer_days,
            "task_timeline": timeline,
        }

    except Exception as e:
        return {"error": str(e)}


def estimate_resources(
    project_type: str, complexity: str, duration_weeks: int
) -> Dict[str, Any]:
    """Estimate resource requirements for a project.

    Args:
        project_type: Type of project (web_app, mobile_app, api, data_pipeline, ml_model)
        complexity: Complexity level (low, medium, high)
        duration_weeks: Expected duration in weeks

    Returns:
        Resource estimation with team composition and costs
    """
    # Base team compositions by project type
    base_teams = {
        "web_app": {
            "frontend_developer": 1,
            "backend_developer": 1,
            "ui_ux_designer": 0.5,
            "qa_engineer": 0.5,
            "project_manager": 0.25,
        },
        "mobile_app": {
            "mobile_developer": 2,
            "backend_developer": 1,
            "ui_ux_designer": 0.5,
            "qa_engineer": 1,
            "project_manager": 0.5,
        },
        "api": {
            "backend_developer": 2,
            "devops_engineer": 0.5,
            "qa_engineer": 0.5,
            "project_manager": 0.25,
        },
        "data_pipeline": {
            "data_engineer": 2,
            "backend_developer": 1,
            "devops_engineer": 0.5,
            "project_manager": 0.25,
        },
        "ml_model": {
            "ml_engineer": 2,
            "data_scientist": 1,
            "data_engineer": 1,
            "backend_developer": 0.5,
            "project_manager": 0.5,
        },
    }

    # Complexity multipliers
    complexity_multipliers = {
        "low": 0.8,
        "medium": 1.0,
        "high": 1.5,
    }

    # Hourly rates (USD)
    hourly_rates = {
        "frontend_developer": 75,
        "backend_developer": 80,
        "mobile_developer": 85,
        "ui_ux_designer": 70,
        "qa_engineer": 60,
        "project_manager": 90,
        "devops_engineer": 85,
        "data_engineer": 90,
        "data_scientist": 100,
        "ml_engineer": 110,
    }

    team = base_teams.get(project_type, base_teams["web_app"])
    multiplier = complexity_multipliers.get(complexity, 1.0)

    team_composition = []
    total_hours = 0
    total_cost = 0

    for role, base_count in team.items():
        count = max(0.25, round(base_count * multiplier * 4) / 4)  # Round to 0.25
        hours = count * duration_weeks * 40  # 40 hours/week
        cost = hours * hourly_rates.get(role, 75)

        team_composition.append(
            {
                "role": role.replace("_", " ").title(),
                "fte_count": count,
                "hours": hours,
                "cost_usd": cost,
            }
        )

        total_hours += hours
        total_cost += cost

    return {
        "project_type": project_type,
        "complexity": complexity,
        "duration_weeks": duration_weeks,
        "team_composition": team_composition,
        "total_hours": total_hours,
        "total_cost_usd": total_cost,
        "cost_per_week_usd": total_cost / duration_weeks if duration_weeks > 0 else 0,
    }


def create_task_breakdown(
    project_name: str, project_type: str, features: List[str]
) -> Dict[str, Any]:
    """Create a work breakdown structure for a project.

    Args:
        project_name: Name of the project
        project_type: Type of project
        features: List of main features/requirements

    Returns:
        Work breakdown structure with phases and tasks
    """
    # Standard phases for software projects
    standard_phases = [
        {
            "name": "Discovery & Planning",
            "duration_ratio": 0.1,
            "tasks": [
                "Requirements gathering",
                "Technical analysis",
                "Architecture design",
                "Project plan creation",
            ],
        },
        {
            "name": "Design",
            "duration_ratio": 0.15,
            "tasks": [
                "UI/UX wireframes",
                "Visual design",
                "Design review & approval",
                "Design handoff",
            ],
        },
        {
            "name": "Development",
            "duration_ratio": 0.5,
            "tasks": [
                "Environment setup",
                "Core infrastructure",
                "Feature development",
                "Integration",
            ],
        },
        {
            "name": "Testing",
            "duration_ratio": 0.15,
            "tasks": [
                "Unit testing",
                "Integration testing",
                "User acceptance testing",
                "Bug fixes",
            ],
        },
        {
            "name": "Deployment",
            "duration_ratio": 0.1,
            "tasks": [
                "Deployment preparation",
                "Production deployment",
                "Documentation",
                "Training & handoff",
            ],
        },
    ]

    # Create breakdown
    breakdown = {
        "project_name": project_name,
        "project_type": project_type,
        "total_features": len(features),
        "phases": [],
    }

    for phase in standard_phases:
        phase_tasks = phase["tasks"].copy()

        # Add feature-specific tasks for development phase
        if phase["name"] == "Development":
            for feature in features[:5]:  # Limit to 5 features
                phase_tasks.append(f"Implement: {feature}")

        breakdown["phases"].append(
            {
                "name": phase["name"],
                "duration_percentage": int(phase["duration_ratio"] * 100),
                "tasks": phase_tasks,
            }
        )

    # Generate milestones
    breakdown["milestones"] = [
        {"name": "Project Kickoff", "phase": "Discovery & Planning"},
        {"name": "Design Approval", "phase": "Design"},
        {"name": "MVP Complete", "phase": "Development"},
        {"name": "Testing Complete", "phase": "Testing"},
        {"name": "Go Live", "phase": "Deployment"},
    ]

    return breakdown


def analyze_project_risks(
    project_type: str,
    team_size: int,
    duration_weeks: int,
    has_external_dependencies: bool = False,
) -> Dict[str, Any]:
    """Analyze potential risks for a project.

    Args:
        project_type: Type of project
        team_size: Number of team members
        duration_weeks: Project duration in weeks
        has_external_dependencies: Whether project depends on external systems

    Returns:
        Risk analysis with mitigation strategies
    """
    risks = []

    # Team-related risks
    if team_size > 5:
        risks.append(
            {
                "category": "Team",
                "risk": "Large team coordination overhead",
                "probability": "medium",
                "impact": "medium",
                "mitigation": "Implement clear communication channels and daily standups",
            }
        )

    if team_size < 2:
        risks.append(
            {
                "category": "Team",
                "risk": "Single point of failure / Key person dependency",
                "probability": "high",
                "impact": "high",
                "mitigation": "Document all decisions and consider adding backup resources",
            }
        )

    # Duration-related risks
    if duration_weeks > 16:
        risks.append(
            {
                "category": "Schedule",
                "risk": "Scope creep due to long duration",
                "probability": "high",
                "impact": "medium",
                "mitigation": "Implement strict change control process and regular scope reviews",
            }
        )

    if duration_weeks < 4:
        risks.append(
            {
                "category": "Schedule",
                "risk": "Aggressive timeline may impact quality",
                "probability": "medium",
                "impact": "high",
                "mitigation": "Prioritize MVP features and plan for post-launch improvements",
            }
        )

    # External dependency risks
    if has_external_dependencies:
        risks.append(
            {
                "category": "Technical",
                "risk": "External system availability and compatibility",
                "probability": "medium",
                "impact": "high",
                "mitigation": "Create abstraction layers and have fallback mechanisms",
            }
        )

    # Project type specific risks
    type_risks = {
        "ml_model": {
            "risk": "Model performance may not meet expectations",
            "probability": "medium",
            "impact": "high",
            "mitigation": "Set clear success metrics early and plan for iteration",
        },
        "mobile_app": {
            "risk": "App store approval delays",
            "probability": "medium",
            "impact": "medium",
            "mitigation": "Follow platform guidelines strictly and plan buffer time",
        },
    }

    if project_type in type_risks:
        risks.append({"category": "Technical", **type_risks[project_type]})

    # Always include common risks
    risks.append(
        {
            "category": "Requirements",
            "risk": "Unclear or changing requirements",
            "probability": "medium",
            "impact": "high",
            "mitigation": "Get written sign-off on requirements and implement change control",
        }
    )

    return {
        "total_risks": len(risks),
        "high_risks": len([r for r in risks if r["impact"] == "high"]),
        "risks": risks,
        "overall_risk_level": (
            "high" if len([r for r in risks if r["impact"] == "high"]) > 2 else "medium"
        ),
    }


def get_project_tools() -> List[FunctionTool]:
    """Get all project planning tools as FunctionTools."""
    return [
        FunctionTool(func=calculate_project_timeline),
        FunctionTool(func=estimate_resources),
        FunctionTool(func=create_task_breakdown),
        FunctionTool(func=analyze_project_risks),
    ]
