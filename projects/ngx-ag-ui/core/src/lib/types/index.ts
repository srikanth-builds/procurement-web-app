export * from './events';
export * from './agent-tool';

export interface RunAgentInputPayload {
  thread_id: string;
  run_id: string;
  parent_run_id: string | null;
  state: Record<string, unknown>;
  messages: Array<{
    id: string;
    role: 'user' | 'tool' | 'assistant' | 'system';
    content: string;
    name?: string | null;
    tool_call_id?: string;
  }>;
  tools: unknown[];
  context: unknown[];
  forwarded_props: Record<string, unknown>;
}

export interface HistoryItem {
  _id: string;
  thread_id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryInputItem extends HistoryItem {
  type: 'input';
  event_type: 'run_agent_input';
  payload: RunAgentInputPayload;
}

export interface HistoryEventItem extends HistoryItem {
  type: 'event';
  event_type: string;
  payload: any; // Using any for ADK events as they are diverse
}

export type HistoryEntry = HistoryInputItem | HistoryEventItem;
