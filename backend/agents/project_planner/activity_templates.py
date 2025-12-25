# agents/project_planner/activity_templates.py

"""Activity templates for the Project Planning agents.

These templates define user-friendly status messages for tool executions.
"""

from ag_ui_adk_ext import ActivityRegistry


def setup_activity_registry() -> ActivityRegistry:
    """Set up activity registry with project planning templates."""

    registry = ActivityRegistry()

    # Timeline calculation
    registry.register(
        "calculate_project_timeline",
        running_template="📅 Calculating project timeline from {start_date}...",
        completed_template="📅 Timeline calculated: {total_duration_days} days with {buffer_days} days buffer",
        failure_template="❌ Failed to calculate timeline: {error}",
    )

    # Resource estimation
    registry.register(
        "estimate_resources",
        running_template="👥 Estimating resources for {project_type} ({complexity} complexity)...",
        completed_template="👥 Resource estimate: {total_hours} hours, ${total_cost_usd:,.0f} total cost",
        failure_template="❌ Failed to estimate resources: {error}",
    )

    # Task breakdown
    registry.register(
        "create_task_breakdown",
        running_template="📋 Creating work breakdown for {project_name}...",
        completed_template="📋 Created {total_features} feature tasks across 5 phases",
        failure_template="❌ Failed to create breakdown: {error}",
    )

    # Risk analysis
    registry.register(
        "analyze_project_risks",
        running_template="⚠️ Analyzing project risks...",
        completed_template=lambda ctx: f"⚠️ Found {ctx.get('total_risks', 0)} risks ({ctx.get('high_risks', 0)} high priority)",
        failure_template="❌ Failed to analyze risks: {error}",
    )

    # Frontend tools
    registry.register(
        "update_project_plan",
        running_template="🔄 Updating project plan...",
        completed_template="✅ Project plan updated",
    )

    registry.register(
        "show_project_summary",
        running_template="📊 Generating project summary...",
        completed_template="✅ Summary displayed",
    )

    registry.register(
        "ask_user_confirmation",
        running_template="❓ Waiting for your confirmation...",
        completed_template="✅ Confirmation received",
    )

    return registry
