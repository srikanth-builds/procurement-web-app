from typing import Set, List, Any, Optional, Dict, Union
import logging
from google.adk.tools.base_toolset import BaseToolset
from google.adk.tools.base_tool import BaseTool
# from google.adk.agents.readonly_context import ReadonlyContext # This might not exist, let's check or remove if unused type hint

from .context import run_context
from .client_proxy_tool import ClientProxyTool

logger = logging.getLogger(__name__)

class FrontendToolSet(BaseToolset):
    """
    A configuration class to define which frontend tools are allowed for an agent.
    
    This allows filtering the tools passed from the frontend (AG-UI) to the agent,
    ensuring the agent only sees tools it is configured to use.
    
    Inherits from BaseToolset to allow being passed in the 'tools' list of an agent.
    """
    def __init__(self, allowed_tools: Union[Set[str], Dict[str, Dict[str, Any]]]):
        """
        Initialize the FrontendToolSet.
        
        Args:
            allowed_tools: A set of tool names or a dict mapping tool names to configuration.
        """
        super().__init__()
        
        if isinstance(allowed_tools, set):
            self.allowed_tool_names = allowed_tools
            self.tool_configs = {}
        elif isinstance(allowed_tools, dict):
            self.allowed_tool_names = set(allowed_tools.keys())
            self.tool_configs = allowed_tools
        else:
            raise ValueError("allowed_tools must be a Set[str] or Dict[str, Dict]")

    async def get_tools(self, readonly_context: Optional[Any] = None) -> List[BaseTool]:
        """
        Dynamically create ClientProxyTool instances for allowed tools based on the current run context.
        """
        ctx = run_context.get()
        if not ctx:
            logger.debug("No run_context active, returning empty tool list for FrontendToolSet")
            return []

        logger.debug(f"FrontendToolSet getting tools from context. Allowed: {self.allowed_tool_names}")
        
        # Filter tools from context
        filtered_tools = self.filter_tools(ctx.available_tools)
        
        # Create proxy tools
        proxy_tools = []
        for tool_def in filtered_tools:
            try:
                tool_name = getattr(tool_def, 'name', None)
                tool_config = self.tool_configs.get(tool_name, {})
                
                proxy_tool = ClientProxyTool(
                    ag_ui_tool=tool_def,
                    event_queue=ctx.event_queue,
                    tool_config=tool_config
                )
                proxy_tools.append(proxy_tool)
            except Exception as e:
                logger.error(f"Failed to create proxy tool for {getattr(tool_def, 'name', 'unknown')}: {e}")
                
        logger.debug(f"FrontendToolSet created {len(proxy_tools)} proxy tools: {[t.name for t in proxy_tools]}")
        return proxy_tools

    def filter_tools(self, tools: List[Any]) -> List[Any]:
        """
        Filter a list of tools, keeping only those whose names are in the allowed set.
        
        Args:
            tools: List of tool objects (expected to have a 'name' attribute).
            
        Returns:
            List of allowed tools.
        """
        filtered_tools = []
        for tool in tools:
            if hasattr(tool, 'name') and tool.name in self.allowed_tool_names:
                filtered_tools.append(tool)
            else:
                logger.debug(f"Filtering out tool: {getattr(tool, 'name', 'unknown')}")
        
        return filtered_tools
