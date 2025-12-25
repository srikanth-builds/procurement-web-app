/**
 * ngx-ag-ui/core - AG-UI Event Types
 * 
 * These match the 16 standard AG-UI protocol events for agent-frontend communication.
 * @see https://docs.ag-ui.com/concepts/events
 */

/**
 * All supported AG-UI event types
 */
export enum EventType {
  // Lifecycle Events
  RUN_STARTED = 'RUN_STARTED',
  RUN_FINISHED = 'RUN_FINISHED',
  RUN_ERROR = 'RUN_ERROR',
  STEP_STARTED = 'STEP_STARTED',
  STEP_FINISHED = 'STEP_FINISHED',

  // Text Message Events
  TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',

  // Tool Call Events
  TOOL_CALL_START = 'TOOL_CALL_START',
  TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
  TOOL_CALL_END = 'TOOL_CALL_END',

  // State Management Events
  STATE_SNAPSHOT = 'STATE_SNAPSHOT',
  STATE_DELTA = 'STATE_DELTA',
  MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',

  // Special Events
  RAW = 'RAW',
  CUSTOM = 'CUSTOM',
  
  // Activity Events (Backend Extensions)
  ACTIVITY_SNAPSHOT = 'ACTIVITY_SNAPSHOT',
  TOOL_CALL_RESULT = 'TOOL_CALL_RESULT',
}

/**
 * Base event interface - all events extend this
 */
export interface BaseEvent {
  type: EventType;
  timestamp?: number;
  rawEvent?: unknown;
}

/**
 * Lifecycle Events
 */
export interface RunStartedEvent extends BaseEvent {
  type: EventType.RUN_STARTED;
  threadId: string;
  runId: string;
  parentRunId?: string;
  input?: unknown;
}

export interface RunFinishedEvent extends BaseEvent {
  type: EventType.RUN_FINISHED;
  threadId: string;
  runId: string;
  result?: unknown;
}

export interface RunErrorEvent extends BaseEvent {
  type: EventType.RUN_ERROR;
  message: string;
  code?: string;
}

export interface StepStartedEvent extends BaseEvent {
  type: EventType.STEP_STARTED;
  stepName: string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: EventType.STEP_FINISHED;
  stepName: string;
}

/**
 * Text Message Events
 */
export interface TextMessageStartEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_START;
  messageId: string;
  role: 'assistant' | 'user' | 'system';
}

export interface TextMessageContentEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_END;
  messageId: string;
}

/**
 * Tool Call Events
 */
export interface ToolCallStartEvent extends BaseEvent {
  type: EventType.TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: EventType.TOOL_CALL_ARGS;
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: EventType.TOOL_CALL_END;
  toolCallId: string;
}

/**
 * State Management Events
 */
export interface StateSnapshotEvent extends BaseEvent {
  type: EventType.STATE_SNAPSHOT;
  state: Record<string, unknown>;
}

export interface StateDeltaEvent extends BaseEvent {
  type: EventType.STATE_DELTA;
  delta: JsonPatchOperation[];
}

export interface MessagesSnapshotEvent extends BaseEvent {
  type: EventType.MESSAGES_SNAPSHOT;
  messages: Message[];
}

/**
 * Special Events
 */
export interface RawEvent extends BaseEvent {
  type: EventType.RAW;
  data: unknown;
}

export interface CustomEvent extends BaseEvent {
  type: EventType.CUSTOM;
  name: string;
  data: unknown;
}

/**
 * JSON Patch operation (RFC 6902)
 */
export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Message type for conversation history
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string; // For tool response messages
  createdAt?: number;
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'executing' | 'complete' | 'error';
}

/**
 * Union type of all events
 */
export type AgEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | MessagesSnapshotEvent
  | RawEvent
  | CustomEvent;
