/**
 * ngx-ag-ui/core - provideReadable
 * 
 * Share application state with the agent as context.
 * Equivalent to CopilotKit's useCopilotReadable hook.
 */
import { inject, DestroyRef, Injector, effect, Signal, isSignal } from '@angular/core';
import { AgContextService } from '../services/ag-context.service';
import { ContextItem } from '../types/state';

/**
 * Options for provideReadable
 */
export interface ProvideReadableOptions {
  /** Custom injector */
  injector?: Injector;
  /** Parent context ID for hierarchical context */
  parentId?: string;
  /** Categories for filtering */
  categories?: string[];
  /** Custom serialization function */
  convert?: (value: unknown) => string;
}

/**
 * Readable configuration
 */
export interface ReadableConfig {
  /** Description of what this data represents */
  description: string;
  /** The value to share (can be a signal for reactivity) */
  value: unknown | Signal<unknown>;
}

/**
 * Share application state with the agent.
 * 
 * @example
 * ```typescript
 * // Static value
 * provideReadable({
 *   description: 'Current user preferences',
 *   value: { theme: 'dark', language: 'en' }
 * });
 * 
 * // Reactive signal
 * const cart = signal<CartItem[]>([]);
 * provideReadable({
 *   description: 'Shopping cart items',
 *   value: cart
 * });
 * ```
 * 
 * @returns Context ID (for manual removal if needed)
 */
export function provideReadable(
  config: ReadableConfig,
  options?: ProvideReadableOptions
): string {
  const injector = options?.injector;
  
  const contextService = injector 
    ? injector.get(AgContextService) 
    : inject(AgContextService);
  const destroyRef = injector 
    ? injector.get(DestroyRef) 
    : inject(DestroyRef);
  
  let contextId: string;
  
  // Handle signals reactively
  if (isSignal(config.value)) {
    // Initial registration
    const serialize = options?.convert ?? JSON.stringify;
    contextId = contextService.addContext({
      description: config.description,
      value: serialize(config.value()),
      parentId: options?.parentId,
      categories: options?.categories,
    });
    
    // Update on signal changes
    effect(() => {
      const currentValue = (config.value as Signal<unknown>)();
      contextService.updateContext(contextId, serialize(currentValue));
    }, { injector });
  } else {
    // Static value
    const serialize = options?.convert ?? JSON.stringify;
    contextId = contextService.addContext({
      description: config.description,
      value: serialize(config.value),
      parentId: options?.parentId,
      categories: options?.categories,
    });
  }
  
  // Auto-cleanup
  destroyRef.onDestroy(() => {
    contextService.removeContext(contextId);
  });
  
  return contextId;
}

/**
 * Remove a readable context by its ID.
 */
export function removeReadable(
  contextId: string,
  options?: { injector?: Injector }
): void {
  const contextService = options?.injector 
    ? options.injector.get(AgContextService) 
    : inject(AgContextService);
  
  contextService.removeContext(contextId);
}
