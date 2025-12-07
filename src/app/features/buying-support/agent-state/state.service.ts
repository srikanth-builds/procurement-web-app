import { computed, Injectable, signal, WritableSignal, Injector, inject } from '@angular/core';
import {
  AppState,
  ProductCard,
  SupplierItem,
  ThinkingStep,
  ThoughtsPanel,
  ToolCallState,
  ToolCallStateStatus,
  ProductOptionsPanel,
  SupplierListPanel,
  PurchaseRequisition,
  SearchProgressPanel,
} from '../models/app-state.model';
import {
  BaseEvent,
  EventType,
  RunErrorEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  ActivitySnapshotEvent,
  StateSnapshotEvent,
  ActivityMessage,
  ToolCallArgsEvent,
  ToolCallResultEvent,
  ToolCallStartEvent,
  ToolCallEndEvent,
  Message,
} from '@ag-ui/core';
import { v4 as uuidv4 } from 'uuid';

const initialState: AppState = {
  runStatus: 'idle',
  currentAgentName: 'Buying Support Agent',
  messages: [],
  activities: [],
  thinkingSteps: [],
  suggestions: [],
  isResourceExhausted: false, // Added
  toolCalls: [], // Initialized
  chatStream: [],
  artifacts: [],
  purchaseRequisition: {
    prId: '',
    requester: { name: 'Sarah Johnson', contact: 'sarah.johnson@company.com' },
    expectedDelivery: new Date().toISOString(),
    justification: '',
    suppliers: [],
    items: [],
    subtotal: 0,
    tax: 0.0825, // Store tax rate, calculate total in a computed signal
    total: 0,
  },
  error: null,
};
@Injectable({ providedIn: 'root' })
export class StateService {
  state: WritableSignal<AppState> = signal(initialState);
  storeEvents: (BaseEvent)[] = [];
  private injector = inject(Injector);

  pendingConfirmationToolId = signal<string | null>(null);

  log_events = computed(() => this.storeEvents);
  // Buffers to correctly associate events
  private toolCallArgBuffer: { [id: string]: string } = {};
  private toolCallNameMap: { [id: string]: string } = {}; // CORRECT: Tracks tool names by ID

  // CORRECT: Regex to find thinking steps like "**Reasoning**: ..."
  private thinkingRegex = /\*\*(.*?)\*\*\s*\n\n([\s\S]*)/;

  constructor() {

  }

  public handleEvent(event: BaseEvent, isRestoring: boolean = false): void {
    this.storeEvents.push(event);

    switch (event.type) {
      case EventType.RUN_STARTED:
        this.state.update((s) => ({
          ...s,
          runStatus: 'running',
          error: null,
          isResourceExhausted: false
        }));
        break;
      case EventType.RUN_FINISHED:
        this.state.update((s) => ({ ...s, runStatus: 'idle' }));
        break;

      case EventType.RUN_ERROR:
        const errorEvent = event as RunErrorEvent;
        const errorMessage = typeof errorEvent.message === 'string' ? errorEvent.message : JSON.stringify(errorEvent.message); // Use errorEvent.message

        // Check for 429 or Resource Exhausted
        const isResourceExhausted = errorMessage.includes('429') || errorMessage.includes('Resource exhausted');

        if (isResourceExhausted) {
          this.state.update(s => ({
            ...s,
            isResourceExhausted: true
          }));
        }

        this.state.update((s) => {
          // 1. Transition any 'running' tools to 'error' state
          const updatedToolCalls = s.toolCalls.map((tc) =>
            tc.status === 'running'
              ? { ...tc, status: 'error' as const, result: errorEvent.message }
              : tc
          );

          // 2. Create a visible system error message for the user (ONLY AT RUNTIME AND IF NOT RESOURCE EXHAUSTED)
          // If it's a resource exhausted error, we prioritize the banner and don't clutter the chat.
          let newChatStream = s.chatStream;
          if (!isRestoring && !isResourceExhausted) {
            const systemErrorMessage: Message = {
              id: `err - ${uuidv4()} `,
              role: 'system',
              content: `An error occurred: ${errorEvent.message} `,
              name: 'System Error',
            };
            newChatStream = [...s.chatStream, systemErrorMessage];
          }

          return {
            ...s,
            runStatus: 'idle', // Stop all loading indicators
            error: errorEvent.message,
            toolCalls: updatedToolCalls,
            chatStream: newChatStream,
          };
        });
        break;
      // ... RUN_FINISHED and RUN_ERROR cases are fine ...

      case EventType.TEXT_MESSAGE_START:
        this.state.update((s) => {
          const assistantMessage: Message = {
            id: (event as TextMessageStartEvent).messageId,
            role: 'assistant',
            content: '',
            name: s.currentAgentName, // CORRECT: Use the 'name' property
          };
          return {
            ...s,
            messages: [...s.messages, assistantMessage],
            chatStream: [...s.chatStream, assistantMessage],
          };
        });
        break;

      case EventType.TEXT_MESSAGE_CONTENT:
        const contentEvent = event as TextMessageContentEvent;
        this.state.update((s) => {
          const newMessages = [...s.messages];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.id === contentEvent.messageId && lastMsg.role === 'assistant') {
            // Ensure content is not undefined
            lastMsg.content = (lastMsg.content || '') + contentEvent.delta;
          }
          return { ...s, messages: newMessages };
        });
        break;
      case EventType.ACTIVITY_SNAPSHOT:
        this.state.update((s) => {
          const activityEvent = event as ActivitySnapshotEvent;

          // Handle Tool Execution Activities
          if (activityEvent.activityType === 'tool_execution' || activityEvent.activityType === 'tool_execution_failed' || activityEvent.activityType === 'tool_execution_completed') {
            const content = activityEvent.content as any;
            const toolName = content.tool || 'Unknown Tool';
            const displayText = content.text || `Using tool: ${toolName} `;
            const toolId = content.tool_id || activityEvent.messageId; // Use tool_id if available

            const isFailure = activityEvent.activityType === 'tool_execution_failed' || content.status === 'failure';
            const isSuccess = content.status === 'success';
            const status = isFailure ? 'error' : (isSuccess ? 'success' : 'running');
            console.log('Tool Execution Activity:', {
              toolName,
              displayText,
              toolId,
              status,
              isFailure,
              isSuccess,
              activityType: activityEvent.activityType,
            });
            // Check if tool call already exists in stream
            const existingIndex = s.chatStream.findIndex(item =>
              'type' in item && item.type === 'tool-call' && item.toolCallId === toolId
            );

            let newStream = [...s.chatStream];
            let updatedToolCalls = [...s.toolCalls];

            if (existingIndex !== -1) {
              // Update existing tool call
              const existingItem = newStream[existingIndex] as ToolCallState;
              newStream[existingIndex] = {
                ...existingItem,
                displayText: displayText,
                status: status === 'error' ? 'error' : existingItem.status, // Only override status if error or specific update
                // If it failed, maybe we want to show the error in result?
                result: status === 'error' ? displayText : existingItem.result
              };
            } else {
              // Create new tool call if it doesn't exist
              const newToolCall: ToolCallState = {
                type: 'tool-call',
                toolCallId: toolId,
                toolName: toolName,
                args: '',
                status: status,
                isExpanded: false,
                updatedAt: new Date(),
                agentName: s.currentAgentName,
                displayText: displayText
              };
              newStream.push(newToolCall);

              // Also add to toolCalls list if not present
              if (!updatedToolCalls.find(tc => tc.toolCallId === toolId)) {
                updatedToolCalls.push(newToolCall);
              }
            }

            return {
              ...s,
              activities: [...s.activities, {
                id: activityEvent.messageId,
                role: 'activity',
                content: activityEvent.content,
                activityType: activityEvent.activityType,
              }],
              chatStream: newStream,
              toolCalls: updatedToolCalls
            };
          } else if (activityEvent.activityType === 'tool_execution_completed') {
            // ... existing logic for completion, but using tool_id if possible ...
            // The previous logic relied on toolName matching or messageId.
            // Let's see if content has tool_id.
            const content = activityEvent.content as any;
            const toolId = content.tool_id; // If available

            const updatedChatStream = s.chatStream.map(item => {
              if ('type' in item && item.type === 'tool-call') {
                // Match by ID if available, otherwise fallback (though tool_id should be there now)
                if (toolId && item.toolCallId === toolId) {
                  return { ...item, status: 'success', updatedAt: new Date() } as ToolCallState;
                }
                // Fallback legacy match
                if (!toolId && item.status === 'running' && item.toolName === content.tool) {
                  return { ...item, status: 'success', updatedAt: new Date() } as ToolCallState;
                }
              }
              return item;
            });

            return {
              ...s,
              activities: [...s.activities, {
                id: activityEvent.messageId,
                role: 'activity',
                content: activityEvent.content,
                activityType: activityEvent.activityType,
              }],
              chatStream: updatedChatStream
            };
          }

          const activityMessage: ActivityMessage = {
            id: activityEvent.messageId,
            role: 'activity',
            content: activityEvent.content,
            activityType: activityEvent.activityType,
          };
          return {
            ...s,
            activities: [...s.activities, activityMessage],
          };
        });
        break;
      case EventType.STATE_SNAPSHOT:
        const snapshot = (event as StateSnapshotEvent).snapshot;
        if (snapshot?.purchaseRequisition) {
          this.state.update((s) => ({
            ...s,
            purchaseRequisition: { ...s.purchaseRequisition, ...snapshot.purchaseRequisition },
          }));
        }
        break;
      case EventType.TOOL_CALL_START:
        const startEvent = event as ToolCallStartEvent;
        // Always track the tool call in the map and state.toolCalls
        this.toolCallNameMap[startEvent.toolCallId] = startEvent.toolCallName;

        const newToolCall: ToolCallState = {
          type: 'tool-call',
          toolCallId: startEvent.toolCallId,
          toolName:
            this.displayToolCallInChat(startEvent.toolCallName)?.on_running ||
            startEvent.toolCallName,
          args: '',
          status: 'running',
          isExpanded: false,
          updatedAt: new Date(),
          agentName: this.state().currentAgentName,
        };

        const shouldDisplay = !this.skipToolDisplay(startEvent.toolCallName);

        // Track pending confirmation
        if (startEvent.toolCallName === 'ask_user_confirmation') {
          this.pendingConfirmationToolId.set(startEvent.toolCallId);
        }

        this.state.update((s) => ({
          ...s,
          toolCalls: [...s.toolCalls, newToolCall],
          // Only add to chatStream if it shouldn't be skipped
          // chatStream: shouldDisplay ? [...s.chatStream, newToolCall] : s.chatStream,
          // BYPASS: We are now using ActivityMessage for tool display. Keeping code for reference/analytics.
          chatStream: s.chatStream,
        }));
        break;
      case EventType.TOOL_CALL_ARGS:
        // CORRECT: Look up the tool name using the ID from the args event
        const argsEvent = event as ToolCallArgsEvent;
        const toolName = this.toolCallNameMap[argsEvent.toolCallId];

        this.state.update((s) => {
          const updatedToolCalls = s.toolCalls.map((tc) =>
            tc.toolCallId === argsEvent.toolCallId
              ? { ...tc, args: (tc.args || '') + argsEvent.delta }
              : tc
          );

          let newStream = [...s.chatStream];
          const existingIndex = newStream.findIndex(item =>
            'type' in item && item.type === 'tool-call' && item.toolCallId === argsEvent.toolCallId
          );

          if (existingIndex !== -1) {
            // Update existing
            const item = newStream[existingIndex] as ToolCallState;
            newStream[existingIndex] = { ...item, args: (item.args || '') + argsEvent.delta };
          } else {
            // Create new if allowed
            if (toolName && !this.skipToolDisplay(toolName)) {
              const newToolCall: ToolCallState = {
                type: 'tool-call',
                toolCallId: argsEvent.toolCallId,
                toolName: this.displayToolCallInChat(toolName)?.on_running || toolName,
                args: argsEvent.delta,
                status: 'running',
                isExpanded: false,
                updatedAt: new Date(),
                agentName: s.currentAgentName
              };
              newStream.push(newToolCall);
            }
          }

          return {
            ...s,
            toolCalls: updatedToolCalls,
            chatStream: newStream
          };
        });
        console.log(argsEvent.delta); // Removed console log to reduce noise

        if (toolName === 'transfer_to_agent') {
          this.toolCallArgBuffer[argsEvent.toolCallId] =
            (this.toolCallArgBuffer[argsEvent.toolCallId] || '') + argsEvent.delta;
          try {
            // Check if the buffered JSON is complete and parse it
            const args = JSON.parse(this.toolCallArgBuffer[argsEvent.toolCallId]);
            if (args.agent_name) {
              this.state.update((s) => ({
                ...s,
                currentAgentName: this.mapInternalAgentNameToDisplayName(args.agent_name),
              }));
            }
          } catch (e) {
            // Incomplete JSON, wait for the next TOOL_CALL_ARGS chunk
          }
        }
        break;

      case EventType.TOOL_CALL_RESULT:
        const resultEvent = event as ToolCallResultEvent;

        // Clear pending confirmation if it matches
        if (this.pendingConfirmationToolId() === resultEvent.toolCallId) {
          this.pendingConfirmationToolId.set(null);
        }

        const currentState = this.state();
        const updatedToolCalls = currentState.toolCalls.map((tc) =>
          tc.toolCallId === resultEvent.toolCallId
            ? ({
              ...tc,
              // Only set to success if it's not already marked as error (e.g. by ACTIVITY_SNAPSHOT)
              status: tc.status === 'error' ? 'error' : 'success',
              result: resultEvent.content,
              updatedAt: new Date(),
            } as ToolCallState)
            : tc
        );

        const updatedChatStream = currentState.chatStream.map((item) => {
          if (
            'type' in item &&
            item.type === 'tool-call' &&
            item.toolCallId === resultEvent.toolCallId
          ) {
            return {
              ...item,
              // Only set to success if it's not already marked as error
              status: item.status === 'error' ? 'error' : 'success',
              result: resultEvent.content,
              updatedAt: new Date(),
            } as ToolCallState;
          }
          return item;
        });

        const updatedState: AppState = {
          ...currentState,
          toolCalls: updatedToolCalls,
          chatStream: updatedChatStream,
        };
        this.state.set(updatedState);
        break;

      case EventType.TOOL_CALL_END:
        // We do NOT execute side effects here anymore.
        // Side effects are explicitly triggered by AgentService (for both live and history events).
        break;

      // Handle Custom Reasoning Events
      case EventType.THINKING_TEXT_MESSAGE_START:
        // Initialize a new thinking step if needed
        break;
      case EventType.THINKING_TEXT_MESSAGE_CONTENT:
        const reasoningDelta = (event as any).delta;

        this.state.update((s) => {
          const lastStreamItem = s.chatStream[s.chatStream.length - 1];
          let newStream = [...s.chatStream];
          let currentPanel: ThoughtsPanel;
          let panelSteps: ThinkingStep[] = [];

          const stepStartRegex = /^\*\*(.*?)\*\*(?:\s*\n\n)?(.*)/s;
          const match = reasoningDelta.match(stepStartRegex);

          if (
            lastStreamItem &&
            'type' in lastStreamItem &&
            lastStreamItem.type === 'thoughts-panel'
          ) {
            // Update existing panel
            currentPanel = { ...lastStreamItem };
            panelSteps = [...currentPanel.steps];
            let lastStep = panelSteps[panelSteps.length - 1];

            if (match) {
              // New Step Detected
              const title = match[1].trim();
              const content = match[2] || '';

              const newStep: ThinkingStep = {
                id: uuidv4(),
                title: title,
                content: content,
                isExpanded: true,
                author: s.currentAgentName,
              };
              panelSteps.push(newStep);
            } else {
              // Continuation
              if (lastStep) {
                lastStep = { ...lastStep, content: lastStep.content + reasoningDelta };
                panelSteps[panelSteps.length - 1] = lastStep;
              } else {
                // Fallback
                const newStep: ThinkingStep = {
                  id: uuidv4(),
                  title: 'Reasoning',
                  content: reasoningDelta,
                  isExpanded: true,
                  author: s.currentAgentName,
                };
                panelSteps.push(newStep);
              }
            }
            currentPanel.steps = panelSteps;
            newStream[newStream.length - 1] = currentPanel;
          } else {
            // Create new panel
            if (match) {
              const title = match[1].trim();
              const content = match[2] || '';
              panelSteps.push({
                id: uuidv4(),
                title: title,
                content: content,
                isExpanded: true,
                author: s.currentAgentName,
              });
            } else {
              panelSteps.push({
                id: uuidv4(),
                title: 'Reasoning',
                content: reasoningDelta,
                isExpanded: true,
                author: s.currentAgentName,
              });
            }

            currentPanel = {
              type: 'thoughts-panel',
              id: `thoughts - panel - ${uuidv4()} `,
              steps: panelSteps,
            };
            newStream.push(currentPanel);
          }

          // We also update the global thinkingSteps for completeness, though it might be less useful now
          // We'll just append the new steps or updated steps to the global list?
          // Actually, let's just rely on the stream for the UI.
          // But we need to return 'thinkingSteps' property as it's part of AppState.
          // We can just leave s.thinkingSteps as is or append to it.
          // For now, let's just return s.thinkingSteps unchanged or append if we really want to track history there.
          // The original code was appending. Let's just append to keep it simple, but it might duplicate if we are not careful.
          // Since we are rebuilding panelSteps from the panel, we don't strictly need s.thinkingSteps for the logic anymore.

          return { ...s, chatStream: newStream };
        });
        break;
      case EventType.THINKING_TEXT_MESSAGE_END:
        // Finalize reasoning step
        break;

      case EventType.CUSTOM:
        const customEvent = event as any;
        if (
          customEvent?.name === 'adk_metadata' &&
          customEvent?.value?.download_info?.type === 'gcs_artifact'
        ) {
          const downloadInfo = customEvent.value.download_info;
          this.state.update((s) => ({
            ...s,
            artifacts: [
              ...(s.artifacts || []),
              {
                filename: downloadInfo.filename,
                version: downloadInfo.version,
                adk_artifact_uri: downloadInfo.adk_artifact_uri,
                gcs_download_url: downloadInfo.gcs_download_url,
                proxy_download_url: downloadInfo.proxy_download_url, // Assuming this is available in the payload based on user request
              },
            ],
          }));
        } else if (customEvent?.name === 'tavily_search_progress') {
          const { search_id, step, data } = customEvent.value;

          this.state.update((s) => {
            let newStream = [...s.chatStream];
            const existingIndex = newStream.findIndex(
              (item) =>
                'type' in item &&
                item.type === 'search-progress-panel' &&
                item.id === search_id
            );

            if (existingIndex !== -1) {
              // Update existing panel
              const panel = { ...(newStream[existingIndex] as SearchProgressPanel) };

              if (step === 'search_start') {
                // Add unique queries
                const newQueries = data.queries || [];
                const uniqueQueries = Array.from(
                  new Set([...panel.queries, ...newQueries])
                );
                panel.queries = uniqueQueries;
                panel.status = 'searching';
              } else if (step === 'result_found') {
                // Add result
                panel.results = [...panel.results, data];
              } else if (step === 'processing_complete') {
                panel.status = 'complete';
              }

              newStream[existingIndex] = panel;
            } else {
              // Create new panel
              const newPanel: SearchProgressPanel = {
                type: 'search-progress-panel',
                id: search_id,
                queries: [],
                results: [],
                status: 'searching',
                isExpanded: true,
              };

              if (step === 'search_start') {
                newPanel.queries = data.queries || [];
              } else if (step === 'result_found') {
                newPanel.results = [data];
              }

              newStream.push(newPanel);
            }

            return { ...s, chatStream: newStream };
          });
        }
        break;

      default:
        // console.warn('Unhandled event type:', event.type);
        break;
    }
  }

  public executeToolSideEffects(toolCallId: string): { status: 'success' | 'error', message: string } | null {
    const toolCall = this.state().toolCalls.find(tc => tc.toolCallId === toolCallId);
    if (!toolCall) return null;

    const toolName = toolCall.toolName;
    let args: any = {};
    if (toolCall.args) {
      try {
        args = JSON.parse(toolCall.args);
      } catch (e) {
        console.error('Failed to parse tool args', e);
        return { status: 'error', message: 'Failed to parse tool arguments' };
      }
    }

    try {
      if (toolName === 'show_products_to_user' || toolName === 'product_options') {
        const products = args['products'];
        if (products) {
          this.updateProductOptions(products);

        }
      } else if (toolName === 'supplier_list') {
        // Inject mock data if args are empty or if explicitly requested for demo
        let suppliers = args['suppliers'];
        if (!suppliers || suppliers.length === 0) {
          console.warn("No suppliers provided");
        }
        this.updateSuppliers(suppliers);
      } else if (toolName === 'show_suggestions') {
        const suggestions = args['suggestions'];
        if (suggestions) {
          this.updateSuggestions(suggestions);
        }
      } else if (toolName === 'update_pr_state') {
        this.handleUpdatePr(args);
        return { status: 'success', message: 'Purchase Requisition updated' };
      }
    } catch (e) {
      console.error('Failed to execute tool logic:', e);
      return { status: 'error', message: `Tool execution failed: ${e}` };
    }

    // Return null if no client-side tool matched (e.g. server-side tool)
    return null;
  }

  public addUserMessage(content: string, id?: string): void {
    const userMessage: Message = { id: id || `msg_${Date.now()} `, role: 'user', content };

    // Check if there is a pending confirmation tool that this message should resolve
    const pendingId = this.pendingConfirmationToolId();
    if (pendingId) {
      this.state.update((s) => {
        const updatedToolCalls = s.toolCalls.map((tc) =>
          tc.toolCallId === pendingId
            ? ({ ...tc, status: 'success', result: content, updatedAt: new Date() } as ToolCallState)
            : tc
        );

      const updatedChatStream = s.chatStream.map((item) => {
        if ('type' in item && item.type === 'tool-call' && item.toolCallId === pendingId) {
          return { ...item, status: 'success', result: content, updatedAt: new Date() } as ToolCallState;
        }
        return item;
      });

      return { ...s, toolCalls: updatedToolCalls, chatStream: updatedChatStream };
      });
      this.pendingConfirmationToolId.set(null);
    }

    this.state.update((s) => ({
      ...s,
      messages: [...s.messages, userMessage],
      chatStream: [...s.chatStream, userMessage],
      suggestions: [],
    }));
  }

  public resolveToolCall(toolCallId: string, result: string): void {
    this.state.update((s) => {
      const updatedToolCalls = s.toolCalls.map((tc) =>
        tc.toolCallId === toolCallId
          ? ({ ...tc, status: 'success', result: result, updatedAt: new Date() } as ToolCallState)
          : tc
      );

      const updatedChatStream = s.chatStream.map((item) => {
        if ('type' in item && item.type === 'tool-call' && item.toolCallId === toolCallId) {
          return { ...item, status: 'success', result: result, updatedAt: new Date() } as ToolCallState;
        }
        return item;
      });

      return { ...s, toolCalls: updatedToolCalls, chatStream: updatedChatStream };
    });
    
    // Also clear pending confirmation if it matches
    if (this.pendingConfirmationToolId() === toolCallId) {
      this.pendingConfirmationToolId.set(null);
    }
  }
  public addProductToPr(product: ProductCard): void {
    this.state.update((s) => {
      const existingItem = s.purchaseRequisition.items.find((item: ProductCard) => {
        if (item.sku && product.sku) {
          return item.sku === product.sku;
        }
        return item.name === product.name;
      });
      if (existingItem) return s; // Item already added

      const newItems = [...s.purchaseRequisition.items, { ...product, quantity: 1 }];
      return { ...s, purchaseRequisition: { ...s.purchaseRequisition, items: newItems } };
    });
  }
  public removeProductFromPr(identifier: string): void {
    this.state.update((s) => ({
      ...s,
      purchaseRequisition: {
        ...s.purchaseRequisition,
        items: s.purchaseRequisition.items.filter((item: ProductCard) =>
          (item.sku ? item.sku !== identifier : item.name !== identifier)
        ),
      },
    }));
  }

  public updateItemQuantity(sku: string, quantity: number): void {
    this.state.update((s) => ({
      ...s,
      purchaseRequisition: {
        ...s.purchaseRequisition,
        items: s.purchaseRequisition.items.map((item) =>
          item.sku === sku || item.name === sku ? { ...item, quantity } : item
        ),
      },
    }));
  }

  public updatePrDetails(details: Partial<PurchaseRequisition>): void {
    this.state.update((s) => ({
      ...s,
      purchaseRequisition: { ...s.purchaseRequisition, ...details },
    }));
  }

  public selectSupplier(supplier: SupplierItem): void {
    this.state.update((s) => {
      const currentSuppliers = s.purchaseRequisition.suppliers;
      const isSelected = currentSuppliers.some((s) => s.id === supplier.id);

      let updatedSuppliers: SupplierItem[];
      if (isSelected) {
        // Remove if already selected
        updatedSuppliers = currentSuppliers.filter((s) => s.id !== supplier.id);
      } else {
        // Add if not selected
        updatedSuppliers = [...currentSuppliers, { ...supplier, selected: true }];
      }

      return this.syncSupplierState(s, updatedSuppliers);
    });
  }

  public removeSupplier(supplierId: string): void {
    this.state.update((s) => {
      const currentSuppliers = s.purchaseRequisition.suppliers;
      const updatedSuppliers = currentSuppliers.filter((s) => s.id !== supplierId);
      return this.syncSupplierState(s, updatedSuppliers);
    });
  }

  private syncSupplierState(s: AppState, updatedSuppliers: SupplierItem[]): AppState {
    // Update Activities (for backward compatibility or other views)
    const updatedActivities = s.activities.map((act) => {
      if (act.activityType === 'supplier_list') {
        const newContent = { ...act.content };
        newContent['suppliers'] = newContent['suppliers'].map((s: any) => ({
          ...s,
          selected: updatedSuppliers.some(us => us.id === s.id),
        }));
        return { ...act, content: newContent };
      }
      return act;
    });

    // Update Chat Stream (for the carousel)
    const updatedChatStream = s.chatStream.map((item) => {
      if ('type' in item && item.type === 'supplier-list-panel') {
        return {
          ...item,
          suppliers: item.suppliers.map((s) => ({
            ...s,
            selected: updatedSuppliers.some((us) => us.id === s.id),
          })),
        };
      }
      return item;
    });

    return {
      ...s,
      activities: updatedActivities,
      chatStream: updatedChatStream,
      purchaseRequisition: { ...s.purchaseRequisition, suppliers: updatedSuppliers },
    };
  }

  public updateSuppliers(suppliers: SupplierItem[]): void {
    this.state.update((s) => {
      // Create a new panel for the chat stream
      const supplierPanel: SupplierListPanel = {
        type: 'supplier-list-panel',
        id: `supplier - list - ${uuidv4()} `,
        suppliers: suppliers,
      };

      // Also update the activity for backward compatibility
      const updatedActivities = s.activities.map((act) => {
        if (act.activityType === 'supplier_list') {
          return { ...act, content: { suppliers } };
        }
        return act;
      });

      return {
        ...s,
        activities: updatedActivities,
        chatStream: [...s.chatStream, supplierPanel], // Add to stream
      };
    });
  }

  public loadDemoData(): void {
    const mockSuppliers: SupplierItem[] = [
      {
        id: 'sup-1',
        name: 'TechGiant Solutions',
        contact: 'contact@techgiant.com',
        rating: 4.8,
        location: 'San Francisco, CA',
        status: 'Preferred',
        website: 'https://techgiant.com'
      },
      {
        id: 'sup-2',
        name: 'Office Depot Inc.',
        contact: 'support@officedepot.com',
        rating: 4.2,
        location: 'Boca Raton, FL',
        status: 'Approved',
        website: 'https://officedepot.com'
      },
      {
        id: 'sup-3',
        name: 'Global Supplies Ltd.',
        contact: 'sales@globalsupplies.com',
        rating: 3.5,
        location: 'New York, NY',
        status: 'Probation',
        website: 'https://globalsupplies.com'
      }
    ];

    // Add a system message to introduce the demo
    const introMsg: Message = {
      id: `msg - ${uuidv4()} `,
      role: 'assistant',
      content: 'Here are the available suppliers for your request:',
      name: 'Buying Support Agent'
    };

    this.state.update(s => ({
      ...s,
      chatStream: [...s.chatStream, introMsg]
    }));

    this.updateSuppliers(mockSuppliers);
  }

  public updateToolCallStatus(toolCallId: string, status: 'success' | 'error', result: any): void {
    const currentState = this.state();
    const updatedChatStream = currentState.chatStream.map((item) => {
      if (
        'type' in item &&
        item.type === 'tool-call' &&
        item.toolCallId === toolCallId
      ) {
        return {
          ...item,
          status,
          result,
          updatedAt: new Date(),
        } as ToolCallState;
      }
      return item;
    });

    this.state.update(s => ({
      ...s,
      chatStream: updatedChatStream
    }));
  }


  // Method to add a generic error message to the chat history for visibility
  public addErrorMessage(content: string): void {
    const errorMessage: Message = {
      id: `err_${Date.now()} `,
      role: 'system', // Use 'system' role for errors
      content,
    };
    this.state.update((s) => ({ ...s, messages: [...s.messages, errorMessage] }));
  }

  public updateSuggestions(suggestions: string[]): void {
    this.state.update((s) => ({ ...s, suggestions }));
  }

  public removeSuggestion(suggestion: string): void {
    this.state.update((s) => ({
      ...s,
      suggestions: s.suggestions.filter((s) => s !== suggestion),
    }));
  }

  public clearSuggestions(): void {
    this.state.update((s) => ({ ...s, suggestions: [] }));
  }

  public clearResourceExhaustedError(): void {
    this.state.update(s => ({ ...s, isResourceExhausted: false }));
  }

  public toggleThinkingStep(stepId: string): void {
    this.state.update((s) => ({
      ...s,
      thinkingSteps: s.thinkingSteps.map((step) =>
        step.id === stepId ? { ...step, isExpanded: !step.isExpanded } : step
      ),
    }));
  }

  public toggleToolCallExpansion(toolCallId: string): void {
    this.state.update((s) => {
      const updatedToolCalls = s.toolCalls.map((tc) =>
        tc.toolCallId === toolCallId ? { ...tc, isExpanded: !tc.isExpanded } : tc
      );
      const updatedChatStream = s.chatStream.map((item) => {
        if ('type' in item && item.type === 'tool-call' && item.toolCallId === toolCallId) {
          return { ...item, isExpanded: !item.isExpanded };
        }
        return item;
      });
      return {
        ...s,
        toolCalls: updatedToolCalls,
        chatStream: updatedChatStream,
      };
    });
  }

  public updateProductOptions(products: any[]): void {
    console.log('Agent Product Options', products);
    this.state.update((s) => {
      // Create a new panel for the chat stream
      const optionsPanel: ProductOptionsPanel = {
        type: 'product-options-panel',
        id: `product - options - ${uuidv4()} `,
        products: products,
      };

      // Also update the activity for backward compatibility or if needed for other views
      const updatedActivities = s.activities.map((act) => {
        if (act.activityType === 'product_options') {
          return { ...act, content: { products } };
        }
        return act;
      });

      return {
        ...s,
        activities: updatedActivities,
        chatStream: [...s.chatStream, optionsPanel], // Add to stream
      };
    });
  }


  private handleUpdatePr(args: any): void {
    this.state.update((s) => {
      let updatedPr = { ...s.purchaseRequisition };
      let validationError = '';

      // Update PR ID
      if (args.purchase_request_id) {
        updatedPr.prId = args.purchase_request_id;
      }

      // Update justification
      if (args.justification) {
        updatedPr.justification = args.justification;
      }

      // Update expected delivery
      if (args.expectedDelivery) {
        updatedPr.expectedDelivery = args.expectedDelivery;
      }

      // Add items (by name and quantity)
      if (args.items && Array.isArray(args.items)) {
        const newItems = [...updatedPr.items];
        for (const item of args.items) {
          const itemName = item.name;
          const itemQuantity = item.quantity || 1;

          // Check if item already exists in PR
          if (!newItems.find(i => i.name === itemName)) {
            // Try to find full product details from history
            const fullProduct = this.findProductInHistory(s, itemName);
            if (fullProduct) {
              newItems.push({ ...fullProduct, quantity: itemQuantity });
            } else {
              // Validation Failed: Item not found in history
              validationError = `Item '${itemName}' not found in the available product options.Please verify the product name or ask the user to select a product first.`;
              break;
            }
          }
        }
        if (!validationError) {
          updatedPr.items = newItems;
        }
      }

      // Add suppliers (by name)
      if (args.suppliers && Array.isArray(args.suppliers) && !validationError) {
        const newSuppliers = [...updatedPr.suppliers];
        for (const supplierName of args.suppliers) {
          if (!newSuppliers.find(sup => sup.name === supplierName)) {
            const fullSupplier = this.findSupplierInHistory(s, supplierName);
            if (fullSupplier) {
              newSuppliers.push(fullSupplier);
            } else {
              // Validation Failed: Supplier not found in history
              validationError = `Supplier '${supplierName}' not found in the available supplier list.Please verify the supplier name.`;
              break;
            }
          }
        }
        if (!validationError) {
          updatedPr.suppliers = newSuppliers;
        }
      }

      if (validationError) {
        // Trigger feedback to agent
        console.warn('PR Update Validation Failed:', validationError);


        // Return original state if validation failed (or partial update? User said "abort" effectively)
        // "it should only add if we have the existing right"
        // So we should probably NOT update the PR if validation fails.
        return s;
      }

      return { ...s, purchaseRequisition: updatedPr };
    });
  }

  private findProductInHistory(state: AppState, name: string): ProductCard | undefined {
    // Search in chat stream for product options panels
    for (const item of state.chatStream) {
      if ('type' in item && item.type === 'product-options-panel') {
        const found = item.products.find(p => p.name === name);
        if (found) return found;
      }
    }
    return undefined;
  }

  private findSupplierInHistory(state: AppState, name: string): SupplierItem | undefined {
    // Search in activities for supplier lists (since we don't have a dedicated panel type for suppliers in stream yet, or maybe we do check activities)
    for (const chatItem of state.chatStream) {
      if ('type' in chatItem && chatItem.type === 'supplier-list-panel') {
        const suppliers = (chatItem as SupplierListPanel).suppliers;
        if (suppliers && Array.isArray(suppliers)) {
          const found = suppliers.find((s) => s.name === name);
          if (found) return found;
        }
      }
    }
    return undefined;
  }

  public toggleSearchPanel(id: string): void {
    this.state.update((s) => {
      const updatedChatStream = s.chatStream.map((item) => {
        if ('type' in item && item.type === 'search-progress-panel' && item.id === id) {
          return { ...item, isExpanded: !item.isExpanded };
        }
        return item;
      });
      return { ...s, chatStream: updatedChatStream };
    });
  }

  public resetState(): void {
    this.state.set(initialState);
  }

  private mapInternalAgentNameToDisplayName(internalName: string): string {
    const mapping: { [key: string]: string } = {
      buying_support_agent: 'Buying Support Agent',
      custom_specialist: 'Custom Specialist Agent',
      need_analyzer: 'Procure Assist Agent',
      supplier_researcher: 'Supplier Recommendation Agent',
      pre_compliance_agent: 'Pre-Compliance Agent',
      post_compliance_agent: 'Post-Compliance Agent',
      pr_drafter_agent: 'Purchase Requisition Drafting Agent',
      pr_formatter_agent: 'PR Formatting Agent',
    };
    return mapping[internalName] || internalName;
  }
  /**
   *
   * @param tool_name
   * @returns
   */
  private skipToolDisplay(tool_name: string) {
    const skipToolNames = ['show_suggestions', 'show_products_to_user'];
    return skipToolNames.find((_tool_name) => _tool_name == tool_name);
  }

  private displayToolCallInChat(tool_name: string) {
    const displayToolNames = [
      {
        tool_name: 'transfer_to_agent',
        on_running: 'Delegating to agent...',
        on_success: 'Agent delegation completed.',
        on_error: 'Agent delegation failed.',
      },
    ];
    return displayToolNames.find((_tool_name) => _tool_name.tool_name == tool_name);
  }
}
