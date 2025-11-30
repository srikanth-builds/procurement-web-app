import { Injectable, inject, signal } from '@angular/core';
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
import { productOptionsTool, suggestionTool, supplierListTool, updatePrTool } from '../agent-tools/agent-tools';



@Injectable({ providedIn: 'root' })
export class AgentService {
  private agent!: HttpAgent;
  private http = inject(HttpClient);
  private stateService = inject(StateService);
  private currentThreadId: string = uuidv4(); // This ID will now persist

  isRunning = signal(false);
  error = signal<string | null>(null);

  private isToolExecutionPending = false;

  constructor() {
    this.initAgent();
  }

  private initAgent(): void {
    // CRITICAL FIX: The HttpAgent is initialized with a threadId that is managed
    // by this service. It will not change unless resetConversation is called.
    this.agent = new HttpAgent({
      url: environment.agentUrl,
      threadId: this.currentThreadId,
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
        }
      },
      onRunFailed: ({ error }) => {
        // Now, this only sets the error state. It does NOT create a new agent or thread.
        const friendlyError = `An error occurred: ${error.message}. Please try again or rephrase your request.`;
        this.error.set(friendlyError);
        this.isRunning.set(false);
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

  async sendMessage(
    content: string,
    context?: any[],
    forwardedProps?: Record<string, any>
  ): Promise<void> {
    const userMessage: Message = { id: `msg_${uuidv4()}`, role: 'user', content };

    this.stateService.addUserMessage(content);
    // The agent's message history is managed internally by the HttpAgent instance,
    // so we just need to add our user message to it before running.
    this.agent.messages.push(userMessage);

    this.isRunning.set(true);
    this.error.set(null);

    const combinedContext = this.buildContext(context);

    try {
      await this.agent.runAgent({
        tools: [suggestionTool, productOptionsTool, supplierListTool, updatePrTool],
        context: combinedContext,
        forwardedProps: forwardedProps || {},
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown agent error occurred.';
      this.error.set(errorMessage);
      this.isRunning.set(false);
      this.stateService.addErrorMessage(errorMessage);
    }
  }



  async sendToolResult(toolCallId: string, result: any, context?: any[]): Promise<void> {
    const toolMessage: Message = {
      id: `tool_${uuidv4()}`,
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId: toolCallId
    };

    console.log('Sending Tool Result:', toolMessage);

    // Add to agent's history
    this.agent.messages.push(toolMessage);

    this.isRunning.set(true);
    this.error.set(null);

    const combinedContext = this.buildContext(context);

    try {
      await this.agent.runAgent({
        tools: [suggestionTool, productOptionsTool, supplierListTool, updatePrTool],
        context: combinedContext
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown agent error occurred.';
      this.error.set(errorMessage);
      this.isRunning.set(false);
      this.stateService.addErrorMessage(errorMessage);
    }
  }

  resetConversation(): void {
    this.stateService.resetState();
    this.currentThreadId = uuidv4(); // A new ID is generated ONLY on explicit reset.
    this.initAgent(); // Re-initialize agent with the new threadId.
    this.error.set(null);
  }

  getThreadId(): string {
    return this.currentThreadId;
  }

  getThreads(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.agentUrl}threads`);
  }

  getHistory(threadId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.agentUrl}history/${threadId}`);
  }

  updateThreadTitle(threadId: string, title: string): Observable<any> {
    return this.http.put<any>(`${environment.agentUrl}threads/${threadId}`, { title });
  }

  deleteThread(threadId: string): Observable<any> {
    return this.http.delete<any>(`${environment.agentUrl}threads/${threadId}`);
  }

  loadConversation(threadId: string): void {
    this.getHistory(threadId).subscribe({
      next: (events) => {
        this.stateService.resetState();
        this.currentThreadId = threadId;
        // Reinitialize agent with the loaded threadId and setup subscriptions
        this.initAgent();

        events.forEach((item: any) => {
          // 1. Handle User Input (from 'run_agent_input' events)
          if (item.type === 'input' && item.payload?.messages) {
            const messages = item.payload.messages;
            if (Array.isArray(messages) && messages.length > 0) {
              // The last message in the input payload is typically the new user message for this run
              const lastMessage = messages[messages.length - 1];
              if (lastMessage.role === 'user') {
                this.stateService.addUserMessage(lastMessage.content, lastMessage.id);
              }
            }
          }
          // 2. Handle Agent Events (from 'event' type)
          else if (item.type === 'event' && item.payload) {
            const normalizedEvent = this.normalizeEvent(item.payload);
            this.stateService.handleEvent(normalizedEvent);

            // Restore state for client-side tools (History Mode - NO result sending)
            if (normalizedEvent.type === EventType.TOOL_CALL_END) {
              const toolCallId = normalizedEvent.toolCallId;
              this.stateService.executeToolSideEffects(toolCallId);
            }
          }
        });
      },
      error: (err) => {
        console.error('Failed to load history', err);
        this.stateService.addErrorMessage('Failed to load conversation history.');
      }
    });
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

    if(event.activity_type){
      event.activityType = event.activity_type;
    }

    // Ensure delta is present for ARGS/CONTENT events if missing (though usually it's there)
    // Some backends might use 'content' instead of 'delta' for text content events?
    // But based on user logs, 'delta' seems to be there for args.

    return event;
  }
}

