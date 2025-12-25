/**
 * ngx-ag-ui/core - provideAction / provideTool
 * 
 * Register frontend actions and tools with the agent context.
 * Equivalent to CopilotKit's useCopilotAction hook.
 */
import { inject, DestroyRef, Injector } from '@angular/core';
import { AgContextService } from '../services/ag-context.service';
import { AgAction, AgCatchAllAction } from '../types/actions';
import { ToolConfig } from '../types/agent-tool';

/**
 * Options for provideAction/provideTool
 */
export interface ProvideActionOptions {
  /** Custom injector (uses current injection context by default) */
  injector?: Injector;
}

/**
 * Validate ToolConfig and throw descriptive errors
 */
function validateToolConfig(config: ToolConfig): void {
  if (!config?.definition) {
    throw new Error('[ngx-ag-ui] provideTool: "definition" is required');
  }
  if (!config.definition.name) {
    throw new Error('[ngx-ag-ui] provideTool: "definition.name" is required');
  }
  if (!config.definition.description) {
    throw new Error('[ngx-ag-ui] provideTool: "definition.description" is required');
  }
  if (!config.definition.parameters) {
    throw new Error('[ngx-ag-ui] provideTool: "definition.parameters" is required');
  }
  if (config.definition.parameters.type !== 'object') {
    throw new Error('[ngx-ag-ui] provideTool: "definition.parameters.type" must be "object"');
  }
  
  // Warn for tools without handler (unless HITL)
  if (!config.handler && !config.hitl) {
    console.warn(
      `[ngx-ag-ui] Tool "${config.definition.name}" has no handler. ` +
      `Consider adding a handler or marking as hitl:true.`
    );
  }
}

/**
 * Register a frontend tool using OpenAPI schema format.
 * 
 * @example
 * ```typescript
 * // In component (field initializer - uses injection context)
 * private toolId = provideTool({
 *   definition: myToolSchema,
 *   handler: (args) => this.handleTool(args),
 *   hitl: true,
 * });
 * 
 * // In service (pass injector explicitly)
 * provideTool({ definition: myToolSchema }, { injector: this.injector });
 * ```
 * 
 * @param config - Tool configuration
 * @param options - Optional configuration (injector)
 * @returns Registration ID (for manual unregistration if needed)
 */
export function provideTool<TArgs = Record<string, unknown>>(
  config: ToolConfig<TArgs>,
  options?: ProvideActionOptions
): string {
  // Validate configuration (cast to base type for validation)
  validateToolConfig(config as ToolConfig);
  
  // Get services from injection context
  let contextService: AgContextService;
  let destroyRef: DestroyRef;
  
  try {
    contextService = options?.injector 
      ? options.injector.get(AgContextService) 
      : inject(AgContextService);
    destroyRef = options?.injector 
      ? options.injector.get(DestroyRef) 
      : inject(DestroyRef);
  } catch {
    throw new Error(
      '[ngx-ag-ui] provideTool must be called within an injection context. ' +
      'Call it in a field initializer, constructor, or pass { injector } option.'
    );
  }
  
  // Convert ToolConfig to AgAction format
  const action: AgAction<TArgs> = {
    name: config.definition.name,
    description: config.definition.description,
    parameters: config.definition.parameters,
    handler: config.handler,
    hitl: config.hitl,
    title: config.title,
    available: 'enabled',
  };
  
  // Register action
  const registrationId = contextService.registerAction(action);
  
  // Auto-cleanup on destroy
  destroyRef.onDestroy(() => {
    contextService.unregisterAction(registrationId);
  });
  
  return registrationId;
}

/**
 * Register a frontend action that the agent can invoke.
 * 
 * @example
 * ```typescript
 * // In a component
 * private actionId = provideAction({
 *   name: 'showProducts',
 *   description: 'Display products to user',
 *   parameters: [
 *     { name: 'products', type: 'array' }
 *   ],
 *   handler: async ({ products }) => {
 *     this.products.set(products);
 *     return { success: true };
 *   },
 * });
 * ```
 * 
 * @param action - Action configuration
 * @param options - Optional configuration
 * @returns Registration ID (for manual unregistration if needed)
 */
export function provideAction<TArgs = Record<string, unknown>>(
  action: AgAction<TArgs>,
  options?: ProvideActionOptions
): string {
  const injector = options?.injector;
  
  // Get services from injection context
  let contextService: AgContextService;
  let destroyRef: DestroyRef;
  
  try {
    contextService = injector 
      ? injector.get(AgContextService) 
      : inject(AgContextService);
    destroyRef = injector 
      ? injector.get(DestroyRef) 
      : inject(DestroyRef);
  } catch {
    throw new Error(
      '[ngx-ag-ui] provideAction must be called within an injection context. ' +
      'Call it in a field initializer, constructor, or pass { injector } option.'
    );
  }
  
  // Register action
  const registrationId = contextService.registerAction(action);
  
  // Auto-cleanup on destroy
  destroyRef.onDestroy(() => {
    contextService.unregisterAction(registrationId);
  });
  
  return registrationId;
}

/**
 * Register a catch-all action renderer for tool calls not explicitly defined.
 * 
 * @example
 * ```typescript
 * provideCatchAllAction({
 *   name: '*',
 *   render: ({ name, args, status }) => {
 *     return DefaultToolComponent;
 *   }
 * });
 * ```
 */
export function provideCatchAllAction(
  action: AgCatchAllAction,
  options?: ProvideActionOptions
): void {
  const contextService = options?.injector 
    ? options.injector.get(AgContextService) 
    : inject(AgContextService);
  
  contextService.registerCatchAllAction(action);
}

/**
 * Unregister an action by its registration ID.
 * Usually not needed as actions auto-cleanup on component destroy.
 */
export function unregisterAction(
  registrationId: string,
  options?: ProvideActionOptions
): void {
  const contextService = options?.injector 
    ? options.injector.get(AgContextService) 
    : inject(AgContextService);
  
  contextService.unregisterAction(registrationId);
}

