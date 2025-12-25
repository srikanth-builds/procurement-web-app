/**
 * ngx-ag-ui/core - AgAgentService
 * 
 * Generic agent service for communicating with AG-UI compatible backends.
 * Abstracted from your existing AgentService for reuse.
 */
import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { AgContextService } from './ag-context.service';
import { 
  EventType, 
  BaseEvent, 
  AgEvent, 
  Message, 
  ToolCall,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  StateSnapshotEvent,
  StateDeltaEvent,
  MessagesSnapshotEvent,
  CustomEvent,
} from '../types/events';
import { 
  AgState, 
  RunStatus, 
  AgentConfig, 
  SendMessageOptions,
  ContextItem,
  createInitialState,
} from '../types/state';

// Import AG-UI client (optional - can be any AG-UI client)
// import { HttpAgent } from '@ag-ui/client';

/**
 * Event callbacks for custom event handling
 */
export interface AgAgentCallbacks {
  onRunStarted?: (event: RunStartedEvent) => void;
  onRunFinished?: (event: RunFinishedEvent) => void;
  onRunError?: (event: RunErrorEvent) => void;
  onMessage?: (message: Message) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onStateSnapshot?: (state: Record<string, unknown>) => void;
  onCustomEvent?: (event: CustomEvent) => void;
}

/**
 * Configuration for AgAgentService
 */
export interface AgAgentServiceConfig extends AgentConfig {
  /** Initial thread ID (generated if not provided) */
  threadId?: string;
  /** Callback handlers */
  callbacks?: AgAgentCallbacks;
  /** Auto-execute tool handlers */
  autoExecuteTools?: boolean;
}

@Injectable()
export class AgAgentService<TCustomState = Record<string, unknown>> {
  private readonly http = inject(HttpClient);
  private readonly contextService = inject(AgContextService);
  
  // Configuration
  private config: AgAgentServiceConfig | null = null;
  private agentSubscription: Subscription | null = null;  

  // ===== State Signals =====
  
  /** Current run status */
  readonly runStatus = signal<RunStatus>('idle');
  
  /** Conversation messages */
  readonly messages = signal<Message[]>([]);
  
  /** Active tool calls */
  readonly toolCalls = signal<ToolCall[]>([]);
  
  /** Current error */
  readonly error = signal<string | null>(null);
  
  /** Custom state synced with agent */
  readonly customState = signal<TCustomState>({} as TCustomState);
  
  /** Run start timestamp for duration tracking */
  readonly runStartedAt = signal<Date | null>(null);
  
  /** Pending confirmation tool ID (for HITL) */
  readonly pendingConfirmationToolId = signal<string | null>(null);

  // ===== Computed Values =====
  
  readonly isLoading = computed(() => this.runStatus() === 'running');
  
  readonly currentThreadId = computed(() => this.contextService.threadId());
  
  readonly currentRunId = computed(() => this.contextService.runId());

  // ===== Message Building State =====
  
  private currentMessageId: string | null = null;
  private currentMessageContent = '';
  private currentToolCallId: string | null = null;
  private currentToolCallArgs = '';

  // ===== Events Subject =====
  
  private readonly eventsSubject = new Subject<AgEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  // ===== Lifecycle =====
  
  /**
   * Initialize the agent service with configuration
   */
  configure(config: AgAgentServiceConfig): void {
    this.config = config;
    
    // Set or generate thread ID
    const threadId = config.threadId ?? uuidv4();
    this.contextService.threadId.set(threadId);
  }

  /**
   * Send a user message to the agent
   */
  async sendMessage(
    content: string, 
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!this.config) {
      throw new Error('AgAgentService not configured. Call configure() first.');
    }
    
    // Add user message to history
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    
    if (!options.skipHistory) {
      this.messages.update(msgs => [...msgs, userMessage]);
    }
    
    // Clear suggestions on new message
    this.contextService.clearSuggestions();
    
    // Execute the run
    await this.executeRun(options.context, options.forwardedProps);
  }

  /**
   * Execute an agent run
   */
  async executeRun(
    additionalContext: ContextItem[] = [],
    forwardedProps: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.config) {
      throw new Error('AgAgentService not configured. Call configure() first.');
    }
    
    // Set loading state
    this.runStatus.set('running');
    this.contextService.isLoading.set(true);
    this.runStartedAt.set(new Date());
    this.error.set(null);
    
    const runId = uuidv4();
    this.contextService.runId.set(runId);
    
    try {
      // Build request payload
      const payload = {
        threadId: this.contextService.threadId(),
        runId,
        messages: this.messages(),
        tools: this.contextService.toolDefinitions(),
        context: [
          ...this.contextService.contextItems(),
          ...additionalContext,
        ],
        ...forwardedProps,
      };
      
      // Make request to agent endpoint
      const response = await this.streamAgentResponse(payload);
      
      // Process events
      for await (const event of response) {
        this.handleEvent(event);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.error.set(errorMessage);
      this.runStatus.set('error');
      this.config.callbacks?.onRunError?.({
        type: EventType.RUN_ERROR,
        message: errorMessage,
      });
    } finally {
      this.contextService.isLoading.set(false);
      this.runStartedAt.set(null);
    }
  }

  /**
   * Send tool result back to agent
   */
  async sendToolResult(
    toolCallId: string, 
    result: unknown,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!this.config) {
      throw new Error('AgAgentService not configured.');
    }
    
    // Update tool call status
    this.toolCalls.update(calls => 
      calls.map(tc => 
        tc.id === toolCallId 
          ? { ...tc, result, status: 'complete' as const }
          : tc
      )
    );
    
    // Clear pending confirmation
    if (this.pendingConfirmationToolId() === toolCallId) {
      this.pendingConfirmationToolId.set(null);
    }
    
    // Continue the run with tool result
    await this.executeRun(options.context, {
      ...options.forwardedProps,
      toolResults: [{ toolCallId, result }],
    });
  }

  /**
   * Reset conversation state
   */
  resetConversation(): void {
    this.messages.set([]);
    this.toolCalls.set([]);
    this.error.set(null);
    this.runStatus.set('idle');
    this.pendingConfirmationToolId.set(null);
    this.customState.set({} as TCustomState);
    this.contextService.threadId.set(uuidv4());
    this.contextService.runId.set(null);
    this.contextService.clearSuggestions();
  }

  /**
   * Get current thread ID
   */
  getThreadId(): string {
    return this.contextService.threadId();
  }

  // ===== Event Handling =====
  
  /**
   * Handle incoming event from agent
   */
  handleEvent(event: AgEvent): void {
    this.eventsSubject.next(event);
    
    switch (event.type) {
      case EventType.RUN_STARTED:
        this.handleRunStarted(event);
        break;
      case EventType.RUN_FINISHED:
        this.handleRunFinished(event);
        break;
      case EventType.RUN_ERROR:
        this.handleRunError(event);
        break;
      case EventType.TEXT_MESSAGE_START:
        this.handleTextMessageStart(event);
        break;
      case EventType.TEXT_MESSAGE_CONTENT:
        this.handleTextMessageContent(event);
        break;
      case EventType.TEXT_MESSAGE_END:
        this.handleTextMessageEnd(event);
        break;
      case EventType.TOOL_CALL_START:
        this.handleToolCallStart(event);
        break;
      case EventType.TOOL_CALL_ARGS:
        this.handleToolCallArgs(event);
        break;
      case EventType.TOOL_CALL_END:
        this.handleToolCallEnd(event);
        break;
      case EventType.STATE_SNAPSHOT:
        this.handleStateSnapshot(event);
        break;
      case EventType.STATE_DELTA:
        this.handleStateDelta(event);
        break;
      case EventType.MESSAGES_SNAPSHOT:
        this.handleMessagesSnapshot(event);
        break;
      case EventType.CUSTOM:
        this.handleCustomEvent(event);
        break;
    }
  }

  private handleRunStarted(event: RunStartedEvent): void {
    this.runStatus.set('running');
    this.config?.callbacks?.onRunStarted?.(event);
  }

  private handleRunFinished(event: RunFinishedEvent): void {
    this.runStatus.set('idle');
    this.config?.callbacks?.onRunFinished?.(event);
  }

  private handleRunError(event: RunErrorEvent): void {
    this.error.set(event.message);
    this.runStatus.set('error');
    this.config?.callbacks?.onRunError?.(event);
  }

  private handleTextMessageStart(event: TextMessageStartEvent): void {
    this.currentMessageId = event.messageId;
    this.currentMessageContent = '';
  }

  private handleTextMessageContent(event: TextMessageContentEvent): void {
    if (event.messageId === this.currentMessageId) {
      this.currentMessageContent += event.delta;
      
      // Update message in place for streaming
      this.updateStreamingMessage();
    }
  }

  private handleTextMessageEnd(event: TextMessageEndEvent): void {
    // Finalize message
    const message: Message = {
      id: this.currentMessageId!,
      role: 'assistant',
      content: this.currentMessageContent,
      createdAt: Date.now(),
    };
    
    this.messages.update(msgs => {
      // Replace streaming message with final
      const existing = msgs.findIndex(m => m.id === message.id);
      if (existing >= 0) {
        const updated = [...msgs];
        updated[existing] = message;
        return updated;
      }
      return [...msgs, message];
    });
    
    this.config?.callbacks?.onMessage?.(message);
    this.currentMessageId = null;
    this.currentMessageContent = '';
  }

  private handleToolCallStart(event: ToolCallStartEvent): void {
    this.currentToolCallId = event.toolCallId;
    this.currentToolCallArgs = '';
    
    const toolCall: ToolCall = {
      id: event.toolCallId,
      name: event.toolName,
      args: {},
      status: 'pending',
    };
    
    this.toolCalls.update(calls => [...calls, toolCall]);
  }

  private handleToolCallArgs(event: ToolCallArgsEvent): void {
    if (event.toolCallId === this.currentToolCallId) {
      this.currentToolCallArgs += event.delta;
    }
  }

  private handleToolCallEnd(event: ToolCallEndEvent): void {
    const args = this.parseToolArgs(this.currentToolCallArgs);
    
    this.toolCalls.update(calls =>
      calls.map(tc =>
        tc.id === event.toolCallId
          ? { ...tc, args, status: 'executing' as const }
          : tc
      )
    );
    
    // Execute tool handler if configured
    if (this.config?.autoExecuteTools !== false) {
      this.executeToolHandler(event.toolCallId, args);
    }
    
    this.currentToolCallId = null;
    this.currentToolCallArgs = '';
  }

  private handleStateSnapshot(event: StateSnapshotEvent): void {
    this.customState.set(event.state as TCustomState);
    this.config?.callbacks?.onStateSnapshot?.(event.state);
  }

  private handleStateDelta(event: StateDeltaEvent): void {
    // Apply JSON patches to custom state
    // TODO: Implement JSON patch application
  }

  private handleMessagesSnapshot(event: MessagesSnapshotEvent): void {
    this.messages.set(event.messages);
  }

  private handleCustomEvent(event: CustomEvent): void {
    // Handle suggestions custom event
    if (event.name === 'suggestions' && Array.isArray(event.data)) {
      this.contextService.setSuggestions(event.data as string[]);
    }
    
    this.config?.callbacks?.onCustomEvent?.(event);
  }

  // ===== Helpers =====
  
  private updateStreamingMessage(): void {
    const streamingMessage: Message = {
      id: this.currentMessageId!,
      role: 'assistant',
      content: this.currentMessageContent,
      createdAt: Date.now(),
    };
    
    this.messages.update(msgs => {
      const existing = msgs.findIndex(m => m.id === streamingMessage.id);
      if (existing >= 0) {
        const updated = [...msgs];
        updated[existing] = streamingMessage;
        return updated;
      }
      return [...msgs, streamingMessage];
    });
  }

  private parseToolArgs(argsString: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch {
      return {};
    }
  }

  private async executeToolHandler(
    toolCallId: string, 
    args: Record<string, unknown>
  ): Promise<void> {
    const toolCall = this.toolCalls().find(tc => tc.id === toolCallId);
    if (!toolCall) return;
    
    const action = this.contextService.getActionByName(toolCall.name);
    if (!action?.handler) return;
    
    try {
      const result = await action.handler(args);
      await this.sendToolResult(toolCallId, result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
      await this.sendToolResult(toolCallId, { error: errorMessage });
    }
  }

  /**
   * Stream response from agent endpoint
   * This is a placeholder - actual implementation depends on your backend
   */
  private async *streamAgentResponse(
    payload: unknown
  ): AsyncGenerator<AgEvent> {
    // This should be implemented based on your backend
    // For now, this is a placeholder that should be overridden
    throw new Error(
      'streamAgentResponse not implemented. ' + 
      'Override this method or use HttpAgent from @ag-ui/client'
    );
  }
}
