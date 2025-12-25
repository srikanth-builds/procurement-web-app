/**
 * ngx-ag-ui/core - Agent Tool Types
 * 
 * Types for defining frontend tools that agents can invoke.
 */

/**
 * OpenAPI-compatible tool schema definition.
 * This is what gets sent to the backend.
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Configuration for registering a frontend tool.
 * Used with provideTool().
 */
export interface ToolConfig<TArgs = Record<string, unknown>> {
  /** OpenAPI-compatible tool definition (sent to backend) */
  definition: AgentTool;
  
  /**
   * Handler executed when agent calls this tool.
   * Return value can be used locally (not sent back to agent for client-proxy tools).
   */
  handler?: (args: TArgs) => unknown | Promise<unknown>;
  
  /**
   * If true, this is a Human-in-the-Loop tool.
   * Activity will stay in 'waiting_for_user' status until response is submitted.
   */
  hitl?: boolean;
  
  /** Display title for activity panel (defaults to tool name) */
  title?: string;
}

/**
 * @deprecated Use ToolConfig instead. Will be removed in next major version.
 */
export interface AgentToolConfig {
  definition: AgentTool;
  hitl?: boolean;
}

