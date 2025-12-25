/**
 * ngx-ag-ui/core - AgContextService
 * 
 * Central context service for managing actions, readables, and agent state.
 * Equivalent to CopilotKit's CopilotContext.
 */
import { Injectable, computed, signal, effect } from '@angular/core';
import { 
  AgAction, 
  RegisteredAction, 
  AgCatchAllAction, 
  ToolDefinition, 
  actionToToolDefinition 
} from '../types/actions';
import { ContextItem, Suggestion } from '../types/state';

let nextContextId = 0;
let nextActionId = 0;

/**
 * Context node for hierarchical context tree
 */
interface ContextNode extends ContextItem {
  id: string;
  children?: ContextNode[];
}

@Injectable({ providedIn: 'root' })
export class AgContextService {
  /**
   * Registered frontend actions
   */
  private readonly actionsMap = signal<Map<string, RegisteredAction>>(new Map());
  
  /**
   * Catch-all action for unhandled tool calls
   */
  private readonly catchAllAction = signal<AgCatchAllAction | null>(null);
  
  /**
   * Context items (readables)
   */
  private readonly contextMap = signal<Map<string, ContextNode>>(new Map());
  
  /**
   * Chat suggestions
   */
  readonly suggestions = signal<Suggestion[]>([]);
  
  /**
   * Additional instructions for the agent
   */
  readonly additionalInstructions = signal<string[]>([]);
  
  /**
   * Current thread ID
   */
  readonly threadId = signal<string>('');
  
  /**
   * Current run ID
   */
  readonly runId = signal<string | null>(null);
  
  /**
   * Loading state
   */
  readonly isLoading = signal<boolean>(false);

  // ===== Computed Values =====
  
  /**
   * All registered actions as array
   */
  readonly actions = computed(() => [...this.actionsMap().values()]);
  
  /**
   * Tool definitions to send to agent
   */
  readonly toolDefinitions = computed<ToolDefinition[]>(() => {
    return this.actions()
      .filter(a => a.available !== 'disabled' && a.available !== 'frontend')
      .map(a => actionToToolDefinition(a));
  });
  
  /**
   * Set of HITL action names (for adapter to check)
   */
  readonly hitlActionNames = computed<Set<string>>(() => {
    const names = new Set<string>();
    for (const action of this.actions()) {
      if (action.hitl) {
        names.add(action.name);
      }
    }
    return names;
  });
  
  /**
   * All context as flat array
   */
  readonly contextItems = computed(() => [...this.contextMap().values()]);
  
  /**
   * Context formatted as string for agent
   */
  readonly contextString = computed(() => {
    const items = this.contextItems();
    if (items.length === 0) return '';
    
    return items
      .map(item => `${item.description}: ${JSON.stringify(item.value)}`)
      .join('\n');
  });

  // ===== Action Management =====
  
  /**
   * Register a frontend action
   * @returns Registration ID (use for unregistering)
   */
  registerAction<TArgs = Record<string, unknown>>(
    action: AgAction<TArgs>
  ): string {
    const id = `action_${++nextActionId}`;
    const registered: RegisteredAction<TArgs> = {
      ...action,
      _id: id,
      _registeredAt: Date.now(),
    };
    
    this.actionsMap.update(map => {
      const newMap = new Map(map);
      newMap.set(id, registered as RegisteredAction);
      return newMap;
    });
    
    return id;
  }
  
  /**
   * Unregister an action
   */
  unregisterAction(id: string): void {
    this.actionsMap.update(map => {
      const newMap = new Map(map);
      newMap.delete(id);
      return newMap;
    });
  }
  
  /**
   * Register catch-all action renderer
   */
  registerCatchAllAction(action: AgCatchAllAction): void {
    this.catchAllAction.set(action);
  }
  
  /**
   * Get action by name
   */
  getActionByName(name: string): RegisteredAction | undefined {
    return this.actions().find(a => a.name === name);
  }
  
  /**
   * Get catch-all action
   */
  getCatchAllAction(): AgCatchAllAction | null {
    return this.catchAllAction();
  }

  // ===== Context Management =====
  
  /**
   * Add context item
   * @returns Context ID (use for removing)
   */
  addContext(item: Omit<ContextItem, 'id'>): string {
    const id = `ctx_${++nextContextId}`;
    const node: ContextNode = { ...item, id };
    
    this.contextMap.update(map => {
      const newMap = new Map(map);
      newMap.set(id, node);
      return newMap;
    });
    
    return id;
  }
  
  /**
   * Remove context item
   */
  removeContext(id: string): void {
    this.contextMap.update(map => {
      const newMap = new Map(map);
      newMap.delete(id);
      return newMap;
    });
  }
  
  /**
   * Update context item
   */
  updateContext(id: string, value: unknown): void {
    this.contextMap.update(map => {
      const existing = map.get(id);
      if (!existing) return map;
      
      const newMap = new Map(map);
      newMap.set(id, { ...existing, value });
      return newMap;
    });
  }

  // ===== Suggestions Management =====
  
  /**
   * Set suggestions
   */
  setSuggestions(suggestions: string[]): void {
    this.suggestions.set(
      suggestions.map((text, i) => ({
        id: `sug_${i}`,
        text,
        visible: true,
      }))
    );
  }
  
  /**
   * Remove a suggestion
   */
  removeSuggestion(id: string): void {
    this.suggestions.update(list => 
      list.filter(s => s.id !== id)
    );
  }
  
  /**
   * Clear all suggestions
   */
  clearSuggestions(): void {
    this.suggestions.set([]);
  }

  // ===== Instructions Management =====
  
  /**
   * Add additional instruction
   */
  addInstruction(instruction: string): void {
    this.additionalInstructions.update(list => [...list, instruction]);
  }
  
  /**
   * Remove additional instruction
   */
  removeInstruction(instruction: string): void {
    this.additionalInstructions.update(list => 
      list.filter(i => i !== instruction)
    );
  }
  
  /**
   * Clear additional instructions
   */
  clearInstructions(): void {
    this.additionalInstructions.set([]);
  }

  // ===== Utility =====
  
  /**
   * Execute a frontend action by name.
   * Returns the handler result, or null if no handler exists.
   */
  async executeAction(name: string, args: Record<string, unknown>): Promise<unknown | null> {
    const action = this.getActionByName(name);
    
    if (!action || !action.handler) {
      return null;
    }
    
    try {
      return await action.handler(args);
    } catch (error) {
      console.error(`[AgContextService] Error executing action "${name}":`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Check if an action has a frontend handler
   */
  hasHandler(name: string): boolean {
    const action = this.getActionByName(name);
    return !!action?.handler;
  }
  
  /**
   * Reset all context state
   */
  reset(): void {
    this.contextMap.set(new Map());
    this.suggestions.set([]);
    this.additionalInstructions.set([]);
    this.threadId.set('');
    this.runId.set(null);
    this.isLoading.set(false);
  }
}
