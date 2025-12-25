/**
 * ngx-ag-ui/ui - Tool Render Registry
 * 
 * Central registry for tool render templates.
 * Templates are registered via ToolRenderDirective and looked up by ToolRenderOutlet.
 */
import { Injectable, TemplateRef, signal, computed } from '@angular/core';

/**
 * Context passed to tool render templates
 */
export interface ToolRenderContext<TArgs = Record<string, unknown>> {
  /** Implicit context - same as the full context (for let-ctx) */
  $implicit: ToolRenderContext<TArgs>;
  /** Tool call ID */
  toolCallId: string;
  /** Tool name */
  toolName: string;
  /** Parsed arguments */
  args: TArgs;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user';
  /** Result after execution (if available) */
  result?: unknown;
  /** Send response back to agent (for HITL) */
  respond?: (result: unknown) => void;
  /** Activity title (from backend ActivityRegistry) */
  title?: string;
  /** Activity description (from backend) */
  description?: string;
  /** Timestamp */
  timestamp?: Date;
  /** Agent that called this tool */
  agentName?: string;
}

/**
 * Registered template entry
 */
interface RegisteredTemplate {
  toolName: string;
  templateRef: TemplateRef<ToolRenderContext>;
  priority: number;
}

/**
 * Registry service for tool render templates.
 * 
 * @example
 * ```typescript
 * // In a component
 * private registry = inject(ToolRenderRegistry);
 * 
 * // Register a template
 * this.registry.register('get_weather', myTemplateRef);
 * 
 * // Get template for a tool
 * const template = this.registry.getTemplate('get_weather');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ToolRenderRegistry {
  private readonly templates = signal<Map<string, RegisteredTemplate>>(new Map());
  private readonly hitlTemplates = signal<Map<string, RegisteredTemplate>>(new Map());
  private catchAllTemplate = signal<TemplateRef<ToolRenderContext> | null>(null);

  /**
   * All registered tool names
   */
  readonly registeredTools = computed(() => 
    Array.from(this.templates().keys())
  );

  /**
   * Register a template for a tool
   * @param toolName - Tool name to match
   * @param templateRef - Template to render
   * @param priority - Higher priority templates win (default: 0)
   * @returns Unregister function
   */
  register(
    toolName: string, 
    templateRef: TemplateRef<ToolRenderContext>,
    priority = 0
  ): () => void {
    this.templates.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(toolName);
      
      // Only replace if higher priority
      if (!existing || priority >= existing.priority) {
        newMap.set(toolName, { toolName, templateRef, priority });
      }
      return newMap;
    });
    
    // Return unregister function
    return () => this.unregister(toolName);
  }

  /**
   * Register a HITL template for a tool
   * @param toolName - Tool name to match
   * @param templateRef - Template to render
   * @param priority - Higher priority templates win (default: 0)
   * @returns Unregister function
   */
  registerHitl(
    toolName: string, 
    templateRef: TemplateRef<ToolRenderContext>,
    priority = 0
  ): () => void {
    console.log('[ngx-ag-ui/registry] Registering HITL template:', toolName);
    
    this.hitlTemplates.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(toolName);
      
      // Only replace if higher priority
      if (!existing || priority >= existing.priority) {
        newMap.set(toolName, { toolName, templateRef, priority });
      }
      return newMap;
    });
    
    // Return unregister function
    return () => this.unregisterHitl(toolName);
  }

  /**
   * Register a catch-all template for tools without specific templates
   */
  registerCatchAll(templateRef: TemplateRef<ToolRenderContext>): () => void {
    this.catchAllTemplate.set(templateRef);
    return () => this.catchAllTemplate.set(null);
  }

  /**
   * Unregister a template
   */
  unregister(toolName: string): void {
    this.templates.update(map => {
      const newMap = new Map(map);
      newMap.delete(toolName);
      return newMap;
    });
  }

  /**
   * Unregister a HITL template
   */
  unregisterHitl(toolName: string): void {
    this.hitlTemplates.update(map => {
      const newMap = new Map(map);
      newMap.delete(toolName);
      return newMap;
    });
  }

  /**
   * Get template for a tool
   */
  getTemplate(toolName: string): TemplateRef<ToolRenderContext> | null {
    const registered = this.templates().get(toolName);
    return registered?.templateRef ?? this.catchAllTemplate();
  }

  /**
   * Get HITL template for a tool
   */
  getHitlTemplate(toolName: string): TemplateRef<ToolRenderContext> | null {
    const registered = this.hitlTemplates().get(toolName);
    return registered?.templateRef ?? null;
  }

  /**
   * Check if a tool has a template (regular or HITL)
   */
  hasTemplate(toolName: string): boolean {
    return this.templates().has(toolName) || 
           this.hitlTemplates().has(toolName) ||
           this.catchAllTemplate() !== null;
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.set(new Map());
    this.hitlTemplates.set(new Map());
    this.catchAllTemplate.set(null);
  }
}
