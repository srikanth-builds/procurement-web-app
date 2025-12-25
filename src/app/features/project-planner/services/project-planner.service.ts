/**
 * Project Planner Agent Service
 * 
 * Demonstrates using AgAdkAdapter from ngx-ag-ui/core.
 * The adapter handles all the common patterns - this service just configures it.
 */
import { Injectable, OnDestroy, inject, Injector } from '@angular/core';
import { AgAdkAdapter, AgContextService, provideTool } from 'ngx-ag-ui/core';

// Environment config
const BASE_URL = 'http://localhost:8001';
const API_URL = `${BASE_URL}/api/project-planner`;
import { HttpClient } from '@angular/common/http';
import { httpResource } from '@angular/common/http';
import { effect, untracked, signal } from '@angular/core';
import { HistoryEntry } from 'ngx-ag-ui/core';

import { 
  productOptionsTool, 
  suggestionTool, 
  supplierListTool, 
  updatePrTool, 
  askUserConfirmationTool 
} from '../../buying-support/agent-tools/agent-tools';

@Injectable({ providedIn: 'root' })
export class ProjectPlannerService implements OnDestroy {
  /**
   * AgContextService holds registered actions and readables.
   * We pull from it when sending messages and executing frontend tools.
   */
  private readonly contextService = inject(AgContextService);
  private readonly injector = inject(Injector);
  private readonly http = inject(HttpClient);
  
  // Thread Management
  readonly threadsResource = httpResource<any[]>(() => `${API_URL}/threads`);
  private historyThreadId = signal<string | null>(null);
  
  readonly historyResource = httpResource<HistoryEntry[]>(() => {
    const threadId = this.historyThreadId();
    return threadId ? `${API_URL}/history/${threadId}` : undefined;
  });

  /**
   * AgAdkAdapter handles all AG-UI event processing:
   * - Message streaming
   * - Tool call tracking
   * - Agent handoff detection
   * - State management
   * - Frontend tool execution (via contextService)
   */
  private adapter = new AgAdkAdapter({
    url: API_URL,
    debug: true, // Enable debug logging
    contextService: this.contextService,
    agentNames: {
      task_planner: 'Task Planner',
      resource_allocator: 'Resource Allocator',
      risk_analyst: 'Risk Analyst',
    },
    toolTitles: {
      calculate_project_timeline: 'Calculating Timeline',
      estimate_resources: 'Estimating Resources',
      create_task_breakdown: 'Creating Tasks',
      analyze_project_risks: 'Analyzing Risks',
      greet_user: 'Greeting User',
      process_order: 'Processing Order',
      approve_budget: 'Approving Budget',
      review_plan: 'Reviewing Plan',
      show_products_to_user: 'Showing Products',
      show_suggestions: 'Showing Suggestions',
      supplier_list: 'Showing Suppliers',
      update_pr_state: 'Updating PR',
      ask_user_confirmation: 'Asking Confirmation',
    },
    // Execute frontend actions via context service
    onToolCallEnd: async (toolCallId, toolName, args) => {
      return this.contextService.executeAction(toolName, args);
    },
  });

  constructor() {
    // Register tools using provideTool (uses injection context)
    this.registerTools();

    // Auto-load history if thread ID exists in local storage
    const savedThreadId = localStorage.getItem('ag_ui_thread_id');
    if (savedThreadId) {
        this.loadHistory(savedThreadId);
    }

    // Reactively restore history when resource loads
    effect(() => {
        const history = this.historyResource.value();
        if (history) {
            untracked(() => {
                this.adapter.restoreHistory(history, this.historyThreadId() ?? undefined);
            });
        }
    });
  }

  private registerTools(): void {
    const opts = { injector: this.injector };
    
    // provideTool({ definition: productOptionsTool }, opts);
    // provideTool({ definition: suggestionTool }, opts);
    // provideTool({ definition: supplierListTool }, opts);
    // provideTool({ definition: updatePrTool }, opts);
    provideTool({ definition: askUserConfirmationTool, hitl: true }, opts);
  }

  // ============================================================================
  // Expose Adapter Signals (readonly to consumers)
  // ============================================================================

  /** All messages in the conversation */
  readonly messages = this.adapter.messages;

  /** Tool call activities */
  readonly activities = this.adapter.activities;

  /** Current active agent name */
  readonly currentAgentName = this.adapter.currentAgentName;

  /** Loading state */
  readonly isLoading = this.adapter.isLoading;
  
  /** Error state */
  readonly error = this.adapter.error;
  
  /** Project state (from predictive state updates) */
  readonly projectState = this.adapter.customState;
  
  /** Thread ID */
  readonly threadId = this.adapter.threadId;

  /**
   * Send a message to the agent.
   */
  async sendMessage(content: string): Promise<void> {
    // Get tool definitions from registered actions
    const tools = this.contextService.toolDefinitions();
    
    // DEBUG: Log what tools are being sent
    console.log('[ProjectPlannerService] Registered actions:', this.contextService.actions());
    console.log('[ProjectPlannerService] HITL action names:', this.contextService.hitlActionNames());
    console.log('[ProjectPlannerService] Sending tools to backend:', tools.map(t => t.name));
    
    // Get context items from registered readables
    const contextItems = this.contextService.contextItems();
    const context = contextItems.map(item => ({
      description: item.description,
      value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
    }));
    
    await this.adapter.sendMessage(content, {
      tools,
      context,
    });
  }

  /**
   * Submit a response to a HITL tool call.
   */
  async submitUserResponse(toolCallId: string, response: unknown): Promise<void> {
    await this.adapter.sendHitlResponse(toolCallId, response);
  }
  
  /**
   * Reset conversation and start fresh
   */
  /**
   * Reset conversation and start fresh
   */
  resetConversation(): void {
    this.adapter.reset();
    this.historyThreadId.set(null);
    localStorage.removeItem('ag_ui_thread_id');
  }

  /**
   * Load a specific conversation history
   */
  loadHistory(threadId: string): void {
      this.historyThreadId.set(threadId);
      localStorage.setItem('ag_ui_thread_id', threadId);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================
  
  ngOnDestroy(): void {
    this.adapter.destroy();
  }
}
