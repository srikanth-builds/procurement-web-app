import { Injectable, inject, signal, resource, effect, untracked } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { HttpAgent } from '@ag-ui/client';
import { Message, EventType } from '@ag-ui/core';
import { StateService } from './state.service';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../../../environments/environments';
// import { ContextItem } from '../../../service/ag-ui.service';
export interface ContextItem {
  description: string;
  value: string;
}
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { productOptionsTool, suggestionTool, supplierListTool, updatePrTool, askUserConfirmationTool } from '../agent-tools/agent-tools';
import { MemoryService } from '../../../core/services/memory.service';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private agent!: HttpAgent;
  private mode: 'ask' | 'agent' = 'ask';
  private http = inject(HttpClient);
  private stateService = inject(StateService);
  private memoryService = inject(MemoryService);
  currentThreadId = signal<string>(uuidv4()); // This ID will now persist

  isRunning = signal(false);
  runStartedAt = signal<Date | null>(null); // Track when the run started for elapsed time display
  error = signal<string | null>(null);

  // Resource for threads
  threadsResource = httpResource<any[]>(() => `${environment.agentUrl}threads`);

  // Signal for current thread ID to drive history resource
  private historyThreadId = signal<string | null>(null);

  // Resource for history
  historyResource = httpResource<any[]>(() => {
    const threadId = this.historyThreadId();
    return threadId ? `${environment.agentUrl}history/${threadId}` : undefined;
  });

  private isToolExecutionPending = false;

  // Track the last action for retry purposes
  private lastAction: {
    type: 'message' | 'tool_result';
    args: any[];
  } | null = null;

  constructor() {
    this.initAgent();

    // Reactively process history when loaded
    effect(() => {
      if (this.historyResource.error()) {
        return;
      }
      const history = this.historyResource.value();
      untracked(() => {
        if (history) {
          this.processHistory(history);
        }
      });
    });
  }

  private initAgent(): void {
    // CRITICAL FIX: The HttpAgent is initialized with a threadId that is managed
    // by this service. It will not change unless resetConversation is called.
    this.agent = new HttpAgent({
      url: environment.agentUrl,
      threadId: this.currentThreadId(),
      initialState: { mode: 'ask' }
    });

    this.agent.subscribe({
      onEvent: (params) => {
        this.stateService.handleEvent(params.event);

        // Handle Tool Feedback Loop for Client-Side Tools
        if (params.event.type === EventType.TOOL_CALL_END) {
          const endEvent = params.event as any;
          const toolCallId = endEvent.toolCallId;

          // Explicitly execute side effects and get result
          const result = this.stateService.executeToolSideEffects(toolCallId);
          console.log('Client Side Tool Result:', result);

          // If a result is returned, it means a client-side tool was executed AND requires a response
          if (result) {
            // We need to send the updated PR state as context because update_pr_state likely changed it
            const prContext: ContextItem = {
              description: 'Current Purchase Requisition State',
              value: JSON.stringify(this.stateService.state().purchaseRequisition),
            };
            this.isToolExecutionPending = true; // Prevent loading state from clearing
            this.sendToolResult(toolCallId, result, [prContext]);
          }
        }
      },
      onRunFinalized: () => {
        if (this.isToolExecutionPending) {
          this.isToolExecutionPending = false;
        } else {
          this.isRunning.set(false);
          this.runStartedAt.set(null); // Clear the start time
        }
      },
      onRunFailed: ({ error }) => {
        // Now, this only sets the error state. It does NOT create a new agent or thread.
        const friendlyError = `An error occurred: ${error.message}. Please try again or rephrase your request.`;
        this.error.set(friendlyError);
        this.isRunning.set(false);
        this.runStartedAt.set(null); // Clear the start time
        this.isToolExecutionPending = false; // Reset on error
        this.stateService.addErrorMessage(friendlyError);
      },
    });
  }



  private buildContext(additionalContext: any[] = []): ContextItem[] {
    const contextItem: ContextItem = {
      description: 'User ID of the requester',
      value: 'EMP-2024-001',
    };
    const prContext: ContextItem = {
      description: 'Current Purchase Requisition State',
      value: JSON.stringify(this.stateService.state().purchaseRequisition),
    };



    // Filter artifacts to reduce token usage
    const artifacts = this.stateService.state().artifacts || [];
    const filteredArtifacts = artifacts.map((a) => ({
      filename: a.filename,
      version: a.version,
      adk_artifact_uri: a.adk_artifact_uri,
    }));

    const artifactsContext: ContextItem = {
      description: 'Available Artifacts',
      value: JSON.stringify(filteredArtifacts),
    };

    // Check if PR context is already provided in additionalContext
    const hasPrContext = additionalContext.some(item => item.description === 'Current Purchase Requisition State');

    const baseContext = [contextItem, artifactsContext];

    if (!hasPrContext) {
      baseContext.push(prContext);
    }

    return [...baseContext, ...additionalContext];
  }

  private async executeRun(additionalContext: any[] = [], forwardedProps: Record<string, any> = {}): Promise<void> {
    this.isRunning.set(true);
    this.runStartedAt.set(new Date()); // Track when the run started
    this.error.set(null);

    const combinedContext = this.buildContext(additionalContext);

    // CRITICAL: Set agent state with user_id and memory_scope for memory feature
    // This state gets synced to the backend session automatically
    const memoryScope = this.memoryService.memoryScope();
    this.agent.state = {
      ...this.agent.state,
      user_id: 'EMP-2024-001',
      memory_scope: memoryScope,
      // org_id is required when memory_scope is 'org'
      ...(memoryScope === 'org' && { org_id: 'procureflow' }),
    };

    try {
      await this.agent.runAgent({
        tools: [suggestionTool, productOptionsTool, supplierListTool, updatePrTool, askUserConfirmationTool],
        context: combinedContext,
        forwardedProps: forwardedProps,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown agent error occurred.';
      this.error.set(errorMessage);
      this.isRunning.set(false);
      this.runStartedAt.set(null); // Clear the start time
      this.stateService.addErrorMessage(errorMessage);
    }
  }

  async sendMessage(
    content: string,
    context?: any[],
    forwardedProps?: Record<string, any>
  ): Promise<void> {
    // Store for retry
    this.lastAction = {
      type: 'message',
      args: [context, forwardedProps] // We don't need content for retry if we just re-run
    };

    const userMessage: Message = { id: `msg_${uuidv4()}`, role: 'user', content };

    this.stateService.addUserMessage(content);
    this.agent.messages.push(userMessage);

    await this.executeRun(context, forwardedProps);
  }

  async retryLastAction(): Promise<void> {
    if (!this.lastAction) {
      console.warn('No action to retry');
      this.stateService.addErrorMessage('Unable to retry automatically. Please try sending your message again.');
      return;
    }

    this.stateService.clearResourceExhaustedError();

    // As per user request, we send a "continue" message to resume the conversation
    // This ensures the backend receives a new_message and processes the history
    const context = this.lastAction.args[0];
    const forwardedProps = this.lastAction.args[1];

    await this.sendMessage('continue', context, forwardedProps);
  }

  async sendToolResult(toolCallId: string, result: any, context?: any[]): Promise<void> {
    // Store for retry
    this.lastAction = {
      type: 'tool_result',
      args: [context, {}] // Tool results usually don't have forwardedProps
    };

    const toolMessage: Message = {
      id: `tool_${uuidv4()}`,
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId: toolCallId
    };

    console.log('Sending Tool Result:', toolMessage);

    this.agent.messages.push(toolMessage);

    await this.executeRun(context, {});
  }

  resetConversation(): void {
    this.stateService.resetState();
    this.currentThreadId.set(uuidv4()); // A new ID is generated ONLY on explicit reset.
    this.initAgent(); // Re-initialize agent with the new threadId.
    this.error.set(null);
    this.lastAction = null;
  }

  getThreadId(): string {
    return this.currentThreadId();
  }

  updateThreadTitle(threadId: string, title: string): Observable<any> {
    return this.http.put<any>(`${environment.agentUrl}threads/${threadId}`, { title });
  }

  deleteThread(threadId: string): Observable<any> {
    return this.http.delete<any>(`${environment.agentUrl}threads/${threadId}`);
  }

  setMode(mode: 'ask' | 'agent'): void {
    this.mode = mode;
    this.agent.state = { mode: this.mode };
  }

  loadConversation(threadId: string): void {
    this.historyThreadId.set(threadId);
  }

  private processHistory(events: any[]): void {
    this.stateService.resetState();
    // Use the ID from the signal, or fallback to current if not set (should be set)
    this.currentThreadId.set(this.historyThreadId() || this.currentThreadId());
    this.initAgent();
    this.lastAction = null; // Reset initially

    events.forEach((item: any) => {
      // 1. Handle User Input (from 'run_agent_input' events)
      if (item.type === 'input' && item.payload?.messages) {
        const messages = item.payload.messages;
        if (Array.isArray(messages) && messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === 'user') {
            this.stateService.addUserMessage(lastMessage.content, lastMessage.id);
            // Set as potential retry point
            this.lastAction = {
              type: 'message',
              args: [[], {}] // Assume no extra context/props for history items
            };
          } else if (lastMessage.role === 'tool') {
            // Handle tool results that come from history inputs (could be multiple if parallel)
            let i = messages.length - 1;
            while (i >= 0) {
              const msg = messages[i];
              if (msg.role === 'tool' && msg.tool_call_id) {
                this.stateService.resolveToolCall(msg.tool_call_id, msg.content);
              } else {
                // Stop if we hit non-tool message
                break;
              }
              i--;
            }
          }
        }
      }
      // 2. Handle Agent Events (from 'event' type)
      else if (item.type === 'event' && item.payload) {
        const normalizedEvent = this.normalizeEvent(item.payload);
        this.stateService.handleEvent(normalizedEvent, true);

        if (normalizedEvent.type === EventType.TOOL_CALL_END) {
          const toolCallId = normalizedEvent.toolCallId;
          this.stateService.executeToolSideEffects(toolCallId);
          // Note: We don't easily know if this tool call *triggered* a run that failed.
          // But if we see a tool call end, it implies a result might follow.
          // For now, relying on 'user' message as the main retry point is safer for history loading.
        }
      }
    });

    // Ensure we don't start in an error state just because the history contained one
    this.stateService.clearResourceExhaustedError();
  }

  private normalizeEvent(payload: any): any {
    // Create a shallow copy to avoid mutating the original if needed
    const event = { ...payload };

    // Map snake_case to camelCase for known properties
    if (event.tool_call_id) {
      event.toolCallId = event.tool_call_id;
    }
    if (event.tool_call_name) {
      event.toolCallName = event.tool_call_name;
    }
    if (event.message_id) {
      event.messageId = event.message_id;
    }

    if (event.activity_type) {
      event.activityType = event.activity_type;
    }

    // Ensure delta is present for ARGS/CONTENT events if missing (though usually it's there)
    // Some backends might use 'content' instead of 'delta' for text content events?
    // But based on user logs, 'delta' seems to be there for args.

    return event;
  }
}

