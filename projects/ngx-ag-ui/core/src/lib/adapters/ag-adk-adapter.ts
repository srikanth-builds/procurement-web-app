/**
 * ngx-ag-ui/core - AgAdkAdapter
 * 
 * Reusable adapter for connecting Angular apps to ADK/AG-UI backends.
 * Handles all common patterns: message streaming, tool tracking, agent handoffs,
 * HITL, and predictive state updates.
 * 
 * Usage:
 * ```typescript
 * @Injectable()
 * export class MyAgentService {
 *   private adapter = new AgAdkAdapter({
 *     url: 'http://localhost:8001/api/my-agent',
 *   });
 * 
 *   messages = this.adapter.messages;
 *   isLoading = this.adapter.isLoading;
 * 
 *   sendMessage(content: string) {
 *     return this.adapter.sendMessage(content);
 *   }
 * }
 * ```
 */
import { signal, computed, WritableSignal, Signal } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import { Message, EventType, AgEvent } from '../types/events';
import { HistoryEntry, HistoryInputItem, HistoryEventItem } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import { AgentTool, AgentToolConfig } from '../types/agent-tool';

// ============================================================================
// Types
// ============================================================================

export interface AgAdkAdapterOptions {
  /** AG-UI endpoint URL */
  url: string;
  
  /** Optional initial thread ID (generates UUID if not provided) */
  threadId?: string;
  
  /** Initial custom state */
  initialState?: Record<string, unknown>;
  
  /** Agent name mappings (internal -> display) */
  agentNames?: Record<string, string>;
  
  /** Tool title mappings (tool_name -> display title) */
  toolTitles?: Record<string, string>;
  
  /**
   * Enable debug logging for tracing events and tool execution
   */
  debug?: boolean;
  
  /**
   * Optional reference to AgContextService.
   * If provided, adapter will pull tool definitions and HITL flags from it.
   */
  contextService?: {
    toolDefinitions: () => Array<{ name: string; description: string; parameters: unknown }>;
    hitlActionNames: () => Set<string>;
    executeAction: (name: string, args: Record<string, unknown>) => Promise<unknown | null>;
    contextItems?: () => Array<{ description: string; value: unknown }>;
  };
  
  /**
   * Callback when a tool call ends.
   * Use this to execute frontend action handlers.
   * Return the result to send back to the agent.
   */
  onToolCallEnd?: (toolCallId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown | null>;
  
  /**
   * Callback for EVERY event received from the backend.
   * Useful for logging, debugging, or triggering animations on specific events.
   * 
   * @example
   * ```typescript
   * onEvent: (event) => {
   *   if (event.type === 'RUN_ERROR') {
   *     this.animationService.shake();
   *   }
   *   console.log('Event:', event);
   * }
   * ```
   */
  onEvent?: (event: AgEvent) => void;
  
  /**
   * Handlers for specific custom event types.
   * Keyed by the custom event's `name` property.
   * 
   * @example
   * ```typescript
   * onCustomEvent: {
   *   'workflow_update': (data) => this.workflowState.set(data),
   *   'notification': (data) => this.toast.show(data.message)
   * }
   * ```
   */
  onCustomEvent?: Record<string, (data: unknown) => void>;
}

// Re-export AgEvent from events.ts (don't duplicate)
// AgEvent is already exported via public-api.ts

/**
 * Custom event stored in customEvents signal.
 * Named StoredCustomEvent to avoid conflict with CustomEvent in events.ts.
 */
export interface StoredCustomEvent {
  id: string;
  name: string;
  data: unknown;
  timestamp: Date;
}

export interface Activity {
  id: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user';
  title: string;
  description?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  timestamp: Date;
  agentName?: string;
}

export interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user';
  result?: unknown;
}

export interface RunContext {
  /** Additional context items to send */
  context?: Array<{ description: string; value: string }>;
  
  /** Tool definitions to include */
  tools?: Array<{ name: string; description: string; parameters: unknown }>;
  
  /** Forwarded props for the agent */
  forwardedProps?: Record<string, unknown>;
}


// ============================================================================
// AgAdkAdapter Class
// ============================================================================

export class AgAdkAdapter {
  // -------------------------------------------------------------------------
  // Private State
  // -------------------------------------------------------------------------
  
  private agent!: HttpAgent;
  private readonly options: AgAdkAdapterOptions;
  
  // Reference to context service (optional - for tool/HITL info)
  private contextService?: AgAdkAdapterOptions['contextService'];
  
  // Dynamic HITL tool names (from context service)
  private hitlToolNames = new Set<string>();
  
  // Message building
  private currentMessageId: string | null = null;
  private currentMessageContent = '';
  
  // Tool call tracking
  private currentToolCallId: string | null = null;
  private toolCallArgsBuffer: Record<string, string> = {}; // Buffer args per tool call
  private toolCallNameMap: Record<string, string> = {};
  private toolCallArgsMap: Record<string, Record<string, unknown>> = {}; // Store parsed args
  
  // HITL resolvers
  private hitlResolvers = new Map<string, (result: unknown) => void>();
  
  // Track subscription for cleanup
  private agentSubscription?: { unsubscribe?: () => void };
  
  // -------------------------------------------------------------------------
  // Public Signals (Reactive State)
  // -------------------------------------------------------------------------
  
  /** Thread ID for this conversation */
  readonly threadId: WritableSignal<string>;
  
  /** Current run ID */
  readonly runId: WritableSignal<string | null> = signal(null);
  
  /** All messages in the conversation */
  readonly messages: WritableSignal<Message[]> = signal([]);
  
  /** Tool call activities */
  readonly activities: WritableSignal<Activity[]> = signal([]);
  
  /** Current active agent name */
  readonly currentAgentName: WritableSignal<string> = signal('Assistant');
  
  /** Loading state */
  readonly isLoading: WritableSignal<boolean> = signal(false);
  
  /** Error state */
  readonly error: WritableSignal<string | null> = signal(null);
  
  /** Custom state (from STATE_SNAPSHOT/STATE_DELTA events) */
  readonly customState: WritableSignal<Record<string, unknown>> = signal({});
  
  /** 
   * Custom events received from the backend.
   * Subscribe to these reactively or use onCustomEvent callback for specific types.
   */
  readonly customEvents: WritableSignal<StoredCustomEvent[]> = signal([]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  
  /** Activities that are currently running */
  readonly runningActivities: Signal<Activity[]> = computed(() => 
    this.activities().filter(a => a.status === 'running')
  );
  
  /** Most recent assistant message */
  readonly lastAssistantMessage: Signal<Message | null> = computed(() => {
    const msgs = this.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i];
    }
    return null;
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------
  
  constructor(options: AgAdkAdapterOptions) {
    // Store options and context service
    this.options = options;
    this.contextService = options.contextService;
    
    this.threadId = signal(options.threadId ?? uuidv4());
    this.customState.set(options.initialState ?? {});
    
    this.initAgent();
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------
  
  /**
   * Send a user message and run the agent
   */
  async sendMessage(content: string, context?: RunContext): Promise<void> {
    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
    };
    
    // Update local state for UI
    this.messages.update(msgs => [...msgs, userMessage]);
    
    // Push to HttpAgent's messages array (CRITICAL for backend)
    this.agent.messages.push(userMessage as any);
    
    // Run agent
    await this.executeRun(context);
  }
  
  /**
   * Send a HITL response back to the agent.
   * Sends as a TOOL message with toolCallId, matching the buying support pattern.
   * Use this for Human-in-the-Loop confirmations/rejections.
   */
  async sendHitlResponse(toolCallId: string, result: unknown, context?: RunContext): Promise<void> {
    // HITL responses are sent as tool messages with toolCallId
    // Format matches buying-support pattern: id = "tool_<uuid>"
    // Backend expects content as JSON object like {"response":"Yes"}, not raw string
    const wrappedResult = typeof result === 'string' 
      ? { response: result }  // Wrap string in object: "Yes" -> {response: "Yes"}
      : result;               // Keep objects as-is (already wrapped)
    
    const toolMessage: Message = {
      id: `tool_${uuidv4()}`,
      role: 'tool',
      content: JSON.stringify(wrappedResult),  // Always JSON stringify
      toolCallId: toolCallId
    };
    
    // Tool messages are internal backend context - they should NOT render as chat bubbles
    // The tool-render-outlet component displays the result via activity status instead

    // Update activity status to completed to reflect user action in UI
    this.activities.update(acts => acts.map(a => 
        a.id === toolCallId 
            ? { ...a, status: 'completed', result } 
            : a
    ));
    
    // Push to agent for backend context
    this.agent.messages.push(toolMessage as any);
    
    // Build run context with tools and context from contextService
    const runContext: RunContext = { ...(context || {}) };
    if (this.contextService) {
        // Ensure tools are passed
        if (!runContext.tools) {
            runContext.tools = this.contextService.toolDefinitions();
        }
        // Ensure context items are passed (if contextItems method available)
        if (!runContext.context && this.contextService.contextItems) {
            runContext.context = this.contextService.contextItems() as any;
        }
    }
    
    await this.executeRun(runContext);
  }
  
  /**
   * Respond to a HITL tool call
   */
  respondToHitl(toolCallId: string, result: unknown): void {
    const resolver = this.hitlResolvers.get(toolCallId);
    if (resolver) {
      resolver(result);
      this.hitlResolvers.delete(toolCallId);
    }
  }
  
  /**
   * Reset conversation and start fresh
   */
  reset(threadId?: string): void {
    // Clean up old subscription to prevent duplicate event handling
    this.agentSubscription?.unsubscribe?.();
    
    // Clear state
    this.messages.set([]);
    this.activities.set([]);
    this.currentAgentName.set('Assistant');
    this.error.set(null);
    this.customState.set(this.options.initialState ?? {});
    this.runId.set(null);
    
    // Clear tracking
    this.currentMessageId = null;
    this.currentMessageContent = '';
    this.currentToolCallId = null;
    this.toolCallArgsBuffer = {};
    this.toolCallNameMap = {};
    this.toolCallArgsMap = {};
    
    // New thread (or use provided)
    this.threadId.set(threadId ?? uuidv4());
    this.initAgent();
  }
  
  /**
   * Update agent name mappings
   */
  setAgentNames(names: Record<string, string>): void {
    this.options.agentNames = { ...this.options.agentNames, ...names };
  }
  
  /**
   * Update tool title mappings
   */
  setToolTitles(titles: Record<string, string>): void {
    this.options.toolTitles = { ...this.options.toolTitles, ...titles };
  }
  
  /**
   * Get a pending HITL tool call (for rendering approval UI)
   */
  getPendingHitlToolCall(toolCallId: string): ToolCallState | undefined {
    const activity = this.activities().find(a => a.id === toolCallId);
    if (!activity) return undefined;
    
    return {
      toolCallId,
      toolName: activity.tool,
      args: JSON.stringify(activity.args ?? {}),
      status: activity.status,
    };
  }

  /**
   * Restores the conversation history from a list of HistoryEntry items.
   * This method will replay the events to reconstruct the UI state.
   */
  async restoreHistory(history: HistoryEntry[], threadId?: string): Promise<void> {
    this.reset(threadId); // Start with a clean state and correct thread ID
    this.isLoading.set(true);
    
    // Track processed message IDs to prevent duplicates
    const processedMessageIds = new Set<string>();
    
    // Track pending HITL tool calls to correlate with user responses
    const pendingHitlTools: Map<string, string> = new Map(); // runId -> toolCallId

    for (const entry of history) {
      if (entry.type === 'input') {
        const inputItem = entry as HistoryInputItem;
        const messages = inputItem.payload.messages;
        const currentRunId = inputItem.metadata?.['run_id'] as string | undefined;
        
        if (messages && Array.isArray(messages)) {
            for (const msg of messages) {
                // Only restore USER messages from input history.
                // Assistant messages will be reconstructed from events.
                if (msg.role === 'user' && !processedMessageIds.has(msg.id)) {
                    const message: Message = {
                        id: msg.id,
                        role: 'user',
                        content: msg.content,
                    };

                    // Safe update to prevent duplicates
                    this.messages.update(msgs => {
                        if (msgs.some(m => m.id === message.id)) return msgs;
                        return [...msgs, message];
                    });
                    this.agent.messages.push(message as any); 
                    processedMessageIds.add(msg.id);
                    
                    // Check if this user message is a response to a pending HITL tool
                    if (currentRunId && pendingHitlTools.has(currentRunId)) {
                        const toolCallId = pendingHitlTools.get(currentRunId)!;
                        this.log('HITL_RESPONSE_DETECTED', { 
                            toolCallId, 
                            runId: currentRunId, 
                            response: msg.content 
                        });
                        
                        // Mark the HITL tool as completed
                        this.activities.update(acts => acts.map(act => {
                            if (act.id === toolCallId) {
                                return { ...act, status: 'completed', result: msg.content };
                            }
                            return act;
                        }));
                        
                        // Remove from pending
                        pendingHitlTools.delete(currentRunId);
                    }
                } else if (msg.role === 'tool' && msg.tool_call_id) {
                     // Handle tool results from history (e.g. explicit HITL responses sent as tool messages)
                     // Tool messages are internal backend context - they should NOT render as chat bubbles
                     // Instead, they update the activity status which is displayed via tool-render-outlet
                     
                     // Push to agent.messages for backend context (if not already there)
                     if (!processedMessageIds.has(msg.id)) {
                         const toolMessage: Message = {
                             id: msg.id,
                             role: 'tool',
                             content: msg.content,
                             toolCallId: msg.tool_call_id
                         };
                         this.agent.messages.push(toolMessage as any);
                         processedMessageIds.add(msg.id);
                     }
                     
                     // Update activity status to completed - this is what shows in the UI
                     this.activities.update(acts => acts.map(act => {
                        if (act.id === msg.tool_call_id) {
                            return { ...act, status: 'completed', result: msg.content };
                        }
                        return act;
                     }));
                }
            }
        }
      } else if (entry.type === 'event') {
        const eventItem = entry as HistoryEventItem;
        // Normalize event payload from snake_case to camelCase
        const normalizedEvent = this.normalizeEvent(eventItem.payload);
        const currentRunId = eventItem.metadata?.['run_id'] as string | undefined;
        
        // Track message IDs from events too
        if (normalizedEvent.messageId) {
            processedMessageIds.add(normalizedEvent.messageId);
        }
        
        // Detect HITL tool calls and track them
        if (normalizedEvent.type === EventType.TOOL_CALL_START && currentRunId) {
            const toolName = normalizedEvent.toolCallName;
            const isHitl = this.contextService?.hitlActionNames().has(toolName || '') || 
                          this.hitlToolNames.has(toolName || '');
            
            if (isHitl) {
                this.log('HITL_TOOL_DETECTED', { 
                    toolCallId: normalizedEvent.toolCallId, 
                    runId: currentRunId,
                    toolName
                });
                pendingHitlTools.set(currentRunId, normalizedEvent.toolCallId);
            }
        }

        // Replay the event, but indicate it's for restoration
        await this.handleEvent(normalizedEvent, true);
      }
    }
    this.isLoading.set(false);
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------
  
  private initAgent(): void {
    this.agent = new HttpAgent({
      url: this.options.url,
      threadId: this.threadId(),
      initialState: this.options.initialState,
    });
    
    // Store subscription for cleanup on reset()
    this.agentSubscription = this.agent.subscribe({
      onEvent: (params: { event: any }) => {
        this.handleEvent(params.event);
      },
      onRunFinalized: () => {
        this.isLoading.set(false);
      },
      onRunFailed: ({ error }: { error: Error }) => {
        this.error.set(error?.message ?? 'Unknown error');
        this.isLoading.set(false);
      },
    });
  }
  
  private async executeRun(context?: RunContext): Promise<void> {
    this.error.set(null);
    this.isLoading.set(true);
    
    const runId = uuidv4();
    this.runId.set(runId);
    
    // DEBUG: Log tools being sent to backend
    const toolsToSend = context?.tools ?? [];
    console.log('[AgAdkAdapter] executeRun - tools being sent:', toolsToSend.map((t: any) => t.name));
    console.log('[AgAdkAdapter] executeRun - full tools array:', toolsToSend);
    
    try {
      await this.agent.runAgent({
        runId,
        tools: toolsToSend,
        context: context?.context ?? [],
        forwardedProps: context?.forwardedProps ?? {},
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to run agent');
      this.isLoading.set(false);
    }
  }
  
  private async handleEvent(event: any, isRestoring = false): Promise<void> {
    // Call onEvent for ALL events (useful for logging, animations, custom handling)
    try {
      this.options.onEvent?.(event as AgEvent);
    } catch (error) {
      console.error('[AgAdkAdapter] onEvent error:', error);
    }
    
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Message Streaming
      // -----------------------------------------------------------------------
      case EventType.TEXT_MESSAGE_START:
        this.handleTextMessageStart(event);
        break;
        
      case EventType.TEXT_MESSAGE_CONTENT:
        this.handleTextMessageContent(event);
        break;
        
      case EventType.TEXT_MESSAGE_END:
        this.finalizeMessage();
        break;
      
      // -----------------------------------------------------------------------
      // Tool Calls
      // -----------------------------------------------------------------------
      case EventType.TOOL_CALL_START:
        this.handleToolCallStart(event);
        break;
        
      case EventType.TOOL_CALL_ARGS:
        this.handleToolCallArgs(event);
        break;
        
      case EventType.TOOL_CALL_END:
        const toolName = this.getToolNameById(event.toolCallId);
        this.log('TOOL_CALL_END', { toolCallId: event.toolCallId, toolName, isRestoring });

        if (toolName === 'transfer_to_agent') {
          this.handleAgentHandoff();
        }

        // Execute side effects (e.g., updating PR state, showing suggestions)
        // This is crucial for both live and restored history.
        // IMPORTANT: For history restoration, we do NOT send responses back to the backend.
        const toolArgs = this.getToolArgsById(event.toolCallId);
        const result = toolName && this.contextService ? this.contextService.executeAction(toolName, toolArgs) : null;
        
        // HITL Logic
        const isHitlTool = this.contextService?.hitlActionNames().has(toolName || '');
        this.log('TOOL_CALL_END HITL check', { isHitl: isHitlTool, toolName });

        if (isHitlTool) {
            // For HITL, we update status to 'waiting_for_user'.
            // If we are restoring history, this status might be overwritten later 
            // if a subsequent 'tool' message (result) is processed.
            // If no result follows, it correctly remains 'waiting_for_user'.
            this.activities.update(acts => acts.map(a => 
                a.id === event.toolCallId 
                    ? { ...a, status: 'waiting_for_user' } 
                    : a
            ));
        } else {
             // Non-HITL tools complete immediately
             this.activities.update(acts => acts.map(a => 
                a.id === event.toolCallId 
                    ? { ...a, status: 'completed', result: result } 
                    : a
            ));
        }
        
        // Frontend handlers are for display/UI effects only (e.g., showing data, logging).
        if (this.options.onToolCallEnd && toolName) {
          try {
            const args = JSON.parse(this.toolCallArgsBuffer[event.toolCallId] || '{}');
            // Execute handler for local side effects - NO response sent back
            this.options.onToolCallEnd(event.toolCallId, toolName, args);
          } catch {
            // Ignore parse errors
          }
        }
        
        // Clean up buffer for this tool call
        this.currentToolCallId = null;
        delete this.toolCallArgsBuffer[event.toolCallId];
        break;
      
      // -----------------------------------------------------------------------
      // Step Events (Multi-Agent)
      // -----------------------------------------------------------------------
      case EventType.STEP_STARTED:
        if (event.stepName) {
          this.currentAgentName.set(this.formatAgentName(event.stepName));
        }
        // Add step activity
        this.addActivity({
          id: event.stepId ?? uuidv4(),
          tool: 'step',
          status: 'running',
          title: `${this.formatAgentName(event.stepName ?? 'Agent')} started`,
          timestamp: new Date(),
          agentName: event.stepName,
        });
        break;
        
      case EventType.STEP_FINISHED:
        // Update step activity
        if (event.stepId) {
          this.updateActivityStatus(event.stepId, 'completed');
        }
        break;
      
      // -----------------------------------------------------------------------
      // State Management (Predictive Updates)
      // -----------------------------------------------------------------------
      case EventType.STATE_SNAPSHOT:
        this.customState.set(event.snapshot ?? {});
        break;
        
      case EventType.STATE_DELTA:
        if (event.delta) {
          this.customState.update(state => ({
            ...state,
            ...event.delta,
          }));
        }
        break;
      
      // -----------------------------------------------------------------------
      // Run Lifecycle
      // -----------------------------------------------------------------------
      case EventType.RUN_STARTED:
        this.isLoading.set(true);
        break;
        
      case EventType.RUN_FINISHED:
        this.isLoading.set(false);
        break;
        
      case EventType.RUN_ERROR:
        this.error.set(event.message ?? 'Run error');
        this.isLoading.set(false);
        break;
      
      // -----------------------------------------------------------------------
      // Custom Events
      // -----------------------------------------------------------------------
      case EventType.CUSTOM:
      case 'CUSTOM':
        this.handleCustomEvent(event);
        break;
        
      case 'activity_snapshot':
      case EventType.ACTIVITY_SNAPSHOT:
        this.handleActivitySnapshot(event);
        break;
        
      case EventType.TOOL_CALL_RESULT:
        this.handleToolCallResult(event);
        break;
    }
  }
  
  // -------------------------------------------------------------------------
  // Message Helpers
  // -------------------------------------------------------------------------
  
  private updateStreamingMessage(): void {
    const msg: Message = {
      id: this.currentMessageId!,
      role: 'assistant',
      content: this.currentMessageContent,
    };
    
    this.messages.update(msgs => {
      const idx = msgs.findIndex(m => m.id === msg.id);
      if (idx >= 0) {
        const updated = [...msgs];
        updated[idx] = msg;
        return updated;
      }
      return [...msgs, msg];
    });
  }
  
  private finalizeMessage(): void {
    this.currentMessageId = null;
    this.currentMessageContent = '';
  }
  
  // -------------------------------------------------------------------------
  // Activity Helpers
  // -------------------------------------------------------------------------
  
  private addActivity(activity: Activity): void {
    this.activities.update(list => {
      // Prevent duplicates (idempotency)
      if (list.some(a => a.id === activity.id)) {
        return list;
      }
      return [...list, activity];
    });
  }
  
  private updateActivityStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user'): void {
    this.activities.update(list =>
      list.map(a => a.id === id ? { ...a, status } : a)
    );
  }
  
  private updateActivityArgs(toolCallId: string): void {
    try {
      // Accumulate args in map as well
      const argsStr = this.toolCallArgsBuffer[toolCallId];
      if (argsStr) {
         try {
             this.toolCallArgsMap[toolCallId] = JSON.parse(argsStr);
         } catch (e) {
             // Ignore incomplete JSON
         }
      }

      const args = JSON.parse(argsStr || '{}');
      this.activities.update(list =>
        list.map(a => a.id === toolCallId ? { ...a, args } : a)
      );
    } catch {
      // Args not yet complete JSON
    }
  }
  
  // -------------------------------------------------------------------------
  // Agent Tracking Helpers
  // -------------------------------------------------------------------------
  
  private handleAgentHandoff(): void {
    if (!this.currentToolCallId) return;
    try {
      const args = JSON.parse(this.toolCallArgsBuffer[this.currentToolCallId] || '{}');
      if (args.agent_name) {
        this.currentAgentName.set(this.formatAgentName(args.agent_name));
      }
    } catch {
      // Ignore parse errors
    }
  }

  private getToolArgsById(toolCallId: string): any {
    if (this.toolCallArgsMap[toolCallId]) {
        return this.toolCallArgsMap[toolCallId];
    }
    // Fallback to parsing string args if not in map (legacy/simple case)
    // But we don't store raw string args by ID easily except current.
    // Ideally handleToolCallArgs populates toolCallArgsMap.
    return {};
  }
  
  private getToolNameById(toolCallId: string): string | undefined {
    return this.toolCallNameMap[toolCallId];
  }
  
  private getToolTitle(toolName: string): string {
    return this.options.toolTitles?.[toolName] ?? toolName.replace(/_/g, ' ');
  }
  
  private formatAgentName(internalName: string): string {
    return this.options.agentNames?.[internalName] ?? 
           internalName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  
  /**
   * Debug logging helper
   */
  private log(event: string, data?: unknown): void {
    if (this.options.debug) {
      console.log(`[ngx-ag-ui] ${event}`, data ?? '');
    }
  }
  
  private handleTextMessageStart(event: any): void {
    this.currentMessageId = event.messageId;
    this.currentMessageContent = '';
  }

  private handleTextMessageContent(event: any): void {
    if (event.messageId === this.currentMessageId) {
      this.currentMessageContent += event.delta;
      this.updateStreamingMessage();
    }
  }

  private handleToolCallStart(event: any): void {
    this.currentToolCallId = event.toolCallId;
    this.toolCallArgsBuffer[event.toolCallId] = ''; // Initialize buffer
    this.toolCallNameMap[event.toolCallId] = event.toolCallName;
    
    this.addActivity({
      id: event.toolCallId,
      tool: event.toolCallName,
      status: 'running',
      title: this.getToolTitle(event.toolCallName),
      timestamp: new Date(),
      agentName: this.currentAgentName(),
    });
  }

  private handleToolCallArgs(event: any): void {
    // Accumulate args in buffer for the specific tool call (supports concurrent tools)
    this.toolCallArgsBuffer[event.toolCallId] = 
      (this.toolCallArgsBuffer[event.toolCallId] || '') + event.delta;
    this.updateActivityArgs(event.toolCallId);
  }



  // -------------------------------------------------------------------------
  // Custom Event Handlers
  // -------------------------------------------------------------------------
  
  private handleCustomEvent(event: any): void {
    // Store in customEvents signal for reactive access
    this.customEvents.update(events => [
      ...events,
      {
        id: event.eventId ?? uuidv4(),
        name: event.name ?? 'unknown',
        data: event.data,
        timestamp: new Date(),
      }
    ]);
    
    // Call typed handler if registered
    const handler = this.options.onCustomEvent?.[event.name];
    if (handler) {
      try {
        handler(event.data);
      } catch (error) {
        console.error(`[AgAdkAdapter] onCustomEvent[${event.name}] error:`, error);
      }
    }
    
    // Built-in handling for known custom event types
    if (event.name === 'activity') {
      this.handleActivitySnapshot(event.data);
    }
  }
  
  private handleActivitySnapshot(event: any): void {
    // Backend sends content as an object with tool details
    const content = event.content || {};
    const toolId = content.tool_id || event.messageId; // Fallback to messageId if tool_id missing
    
    if (!toolId) return;
    
    const activityUpdate: Partial<Activity> = {
      id: toolId,
      tool: content.tool || 'unknown',
      status: content.status || 'running',
      title: content.text || this.getToolTitle(content.tool || 'unknown'),
      description: content.description,
      timestamp: new Date(),
    };

    const existing = this.activities().find(a => a.id === toolId);
    if (existing) {
      this.activities.update(list =>
        list.map(a => a.id === toolId ? { ...a, ...activityUpdate } : a)
      );
    } else {
      this.addActivity({
        id: toolId,
        tool: activityUpdate.tool!,
        status: activityUpdate.status as any,
        title: activityUpdate.title!,
        description: activityUpdate.description,
        timestamp: new Date(),
        // Try to preserve args if we have them tracked locally
        args: this.toolCallArgsBuffer[toolId] ? JSON.parse(this.toolCallArgsBuffer[toolId] || '{}') : undefined
      });
    }
  }

  private handleToolCallResult(event: any): void {
    const toolId = event.toolCallId;
    if (!toolId) return;

    try {
      const result = typeof event.content === 'string' ? JSON.parse(event.content) : event.content;
      this.activities.update(list =>
        list.map(a => a.id === toolId ? { ...a, result, status: 'completed' } : a)
      );
    } catch {
      // Ignore parse errors
    }
  }
  
  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private normalizeEvent(payload: any): any {
    if (!payload) return payload;
    
    // Create a new object to avoid mutating the original
    const normalized: any = { ...payload };

    // Map common snake_case fields to camelCase
    if (normalized.tool_call_id) normalized.toolCallId = normalized.tool_call_id;
    if (normalized.tool_call_name) normalized.toolCallName = normalized.tool_call_name;
    if (normalized.message_id) normalized.messageId = normalized.message_id;
    if (normalized.parent_message_id) normalized.parentMessageId = normalized.parent_message_id;
    if (normalized.run_id) normalized.runId = normalized.run_id;
    if (normalized.thread_id) normalized.threadId = normalized.thread_id;
    if (normalized.step_id) normalized.stepId = normalized.step_id;
    if (normalized.step_name) normalized.stepName = normalized.step_name;
    
    // Handle nested objects if necessary (e.g. delta in some cases?)
    // Usually top-level is sufficient for the adapter's switch statement.
    
    return normalized;
  }
  
  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  
  /**
   * Call when destroying the adapter (e.g., in ngOnDestroy)
   */
  destroy(): void {
    // Cleanup if needed in future
  }
}
