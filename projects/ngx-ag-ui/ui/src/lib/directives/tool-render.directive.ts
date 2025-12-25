/**
 * ngx-ag-ui/ui - ToolRenderDirective
 * 
 * Structural directive for registering custom UI templates for tool calls.
 * Templates are automatically registered with ToolRenderRegistry.
 * 
 * @example
 * ```html
 * <ng-template agToolRender="get_weather" let-ctx let-args="args" let-status="status">
 *   <app-weather-card [location]="args.location" [loading]="status === 'running'" />
 * </ng-template>
 * ```
 */
import { 
  Directive, 
  Input, 
  TemplateRef, 
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ToolRenderRegistry, ToolRenderContext } from '../services/tool-render-registry';

/**
 * Directive for registering tool render templates.
 * 
 * Context variables available in template:
 * - `$implicit` or `let-ctx`: Full context object
 * - `args`: Parsed tool arguments
 * - `result`: Tool execution result
 * - `status`: 'pending' | 'running' | 'completed' | 'failed'
 * - `toolCallId`: Unique ID of this call
 * - `toolName`: Name of the tool
 * - `respond`: Function to send HITL response
 * - `title`: Activity title (from backend)
 * - `description`: Activity description (from backend)
 * - `agentName`: Agent that called this tool
 */
@Directive({
  selector: '[agToolRender]',
  standalone: true,
})
export class ToolRenderDirective<TArgs = Record<string, unknown>> implements OnInit, OnDestroy {
  private readonly templateRef = inject(TemplateRef<ToolRenderContext<TArgs>>);
  private readonly registry = inject(ToolRenderRegistry);
  
  private unregister?: () => void;
  
  /**
   * Tool name to render. Use '*' for catch-all.
   */
  @Input({ required: true }) agToolRender!: string;
  
  /**
   * Priority for this template (higher wins if multiple match)
   */
  @Input() agToolRenderPriority = 0;

  ngOnInit(): void {
    if (this.agToolRender === '*') {
      // Catch-all template
      this.unregister = this.registry.registerCatchAll(
        this.templateRef as TemplateRef<ToolRenderContext>
      );
    } else {
      // Specific tool template
      this.unregister = this.registry.register(
        this.agToolRender,
        this.templateRef as TemplateRef<ToolRenderContext>,
        this.agToolRenderPriority
      );
    }
  }

  ngOnDestroy(): void {
    this.unregister?.();
  }

  /**
   * Static context type guard for type inference in templates
   */
  static ngTemplateContextGuard<TArgs>(
    dir: ToolRenderDirective<TArgs>,
    ctx: unknown
  ): ctx is ToolRenderContext<TArgs> {
    return true;
  }
}
