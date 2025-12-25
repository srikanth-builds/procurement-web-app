/**
 * ngx-ag-ui/core - State Types
 * 
 * State management types for agent-frontend synchronization.
 */
import { Message, ToolCall } from './events';

/**
 * Run status for agent execution
 */
export type RunStatus = 'idle' | 'running' | 'error' | 'awaiting_input';

/**
 * Context item for providing app state to agent
 */
export interface ContextItem {
  /** Unique identifier */
  id?: string;
  /** Human-readable description of what this context represents */
  description: string;
  /** The context value (will be serialized) */
  value: unknown;
  /** Parent context ID for hierarchical context */
  parentId?: string;
  /** Categories for filtering (e.g., 'chat', 'form') */
  categories?: string[];
}

/**
 * Suggestion for the user shown in chat
 */
export interface Suggestion {
  /** Unique identifier */
  id: string;
  /** Display text */
  text: string;
  /** Whether currently visible */
  visible?: boolean;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent endpoint URL */
  url: string;
  /** Agent identifier */
  agentId?: string;
  /** Request headers (e.g., for auth) */
  headers?: Record<string, string>;
  /** Request credentials mode */
  credentials?: RequestCredentials;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** Additional context to include */
  context?: ContextItem[];
  /** Properties forwarded to agent */
  forwardedProps?: Record<string, unknown>;
  /** Skip adding to message history */
  skipHistory?: boolean;
}

/**
 * Core agent state
 */
export interface AgState<TCustomState = Record<string, unknown>> {
  /** Current run status */
  runStatus: RunStatus;
  /** Current thread ID */
  threadId: string;
  /** Current run ID */
  runId: string | null;
  /** Conversation messages */
  messages: Message[];
  /** Active tool calls */
  toolCalls: ToolCall[];
  /** Suggestions for user */
  suggestions: Suggestion[];
  /** Error information if any */
  error: string | null;
  /** Custom application state synced with agent */
  custom: TCustomState;
}

/**
 * Initial state factory
 */
export function createInitialState<T = Record<string, unknown>>(
  customState?: T
): AgState<T> {
  return {
    runStatus: 'idle',
    threadId: '',
    runId: null,
    messages: [],
    toolCalls: [],
    suggestions: [],
    error: null,
    custom: customState ?? ({} as T),
  };
}
