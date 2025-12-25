/**
 * ngx-ag-ui/core - Action Types
 * 
 * Actions are frontend-defined tools that agents can invoke.
 * Equivalent to CopilotKit's useCopilotAction.
 */
import { TemplateRef, Type } from '@angular/core';

/**
 * Parameter definition for an action
 */
export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'string[]' | 'number[]';
  description?: string;
  required?: boolean;
  enum?: string[];
  attributes?: ActionParameter[]; // For nested objects
}

/**
 * Render props passed to custom action renderers
 */
export interface ActionRenderProps<TArgs = Record<string, unknown>> {
  /** The action name */
  name: string;
  /** Parsed arguments from the agent */
  args: TArgs;
  /** Current execution status */
  status: 'pending' | 'executing' | 'complete' | 'error';
  /** Result after handler execution */
  result?: unknown;
  /** Call this to send a response back to the agent (HITL) */
  respond?: (result: unknown) => void;
}

/**
 * Custom renderer for an action - can be a component, template, or string
 */
export type ActionRenderer<TArgs = Record<string, unknown>> = 
  | Type<unknown>
  | TemplateRef<ActionRenderProps<TArgs>>
  | ((props: ActionRenderProps<TArgs>) => string);

/**
 * Parameter schema - supports two formats:
 * 1. Simple: ActionParameter[] (converted to JSON Schema)
 * 2. OpenAPI: { type: 'object', properties: {...} } (passed through as-is)
 */
export type ParameterSchema = ActionParameter[] | {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Frontend action definition
 */
export interface AgAction<TArgs = Record<string, unknown>> {
  /** Unique action name (used by agent to invoke) */
  name: string;
  
  /** Description for the agent to understand when to use this action */
  description: string;
  
  /** Parameter schema - simple array or OpenAPI object format */
  parameters?: ParameterSchema;
  
  /** 
   * Handler function executed when agent calls this action.
   * Return value is sent back to agent as tool result.
   */
  handler?: (args: TArgs) => unknown | Promise<unknown>;
  
  /**
   * Custom renderer for the action in chat UI.
   * If provided, this will be displayed instead of default tool call UI.
   */
  render?: ActionRenderer<TArgs>;
  
  /**
   * Availability mode:
   * - 'enabled': Available both locally and to agent (default)
   * - 'disabled': Not available (temporarily disabled)
   * - 'frontend': Only rendered locally, not sent to agent
   * - 'remote': Defined by agent, rendered locally
   */
  available?: 'enabled' | 'disabled' | 'frontend' | 'remote';
  
  /**
   * If true, this is a Human-in-the-Loop tool.
   * Activity will stay in 'waiting_for_user' status until response is submitted.
   */
  hitl?: boolean;
  
  /** Display title for activity panel (defaults to formatted tool name) */
  title?: string;
}

/**
 * Catch-all action for rendering any tool call not explicitly defined
 */
export interface AgCatchAllAction {
  name: '*';
  render: ActionRenderer<Record<string, unknown>>;
}

/**
 * Registered action with internal metadata
 */
export interface RegisteredAction<TArgs = Record<string, unknown>> extends AgAction<TArgs> {
  /** Internal registration ID */
  _id: string;
  /** When action was registered */
  _registeredAt: number;
}

/**
 * Tool definition to send to agent (JSON Schema format)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Convert AgAction parameters to JSON Schema for agent.
 * Handles both simple ActionParameter[] and OpenAPI object formats.
 */
export function actionToToolDefinition(action: AgAction): ToolDefinition {
  // If parameters is already in OpenAPI format, use it directly
  if (action.parameters && !Array.isArray(action.parameters)) {
    return {
      name: action.name,
      description: action.description,
      parameters: {
        type: 'object',
        properties: action.parameters.properties,
        required: action.parameters.required,
      },
    };
  }
  
  // Convert simple array format to OpenAPI format
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  
  for (const param of (action.parameters as ActionParameter[]) ?? []) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? { enum: param.enum } : {}),
    };
    if (param.required !== false) {
      required.push(param.name);
    }
  }
  
  return {
    name: action.name,
    description: action.description,
    parameters: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}
