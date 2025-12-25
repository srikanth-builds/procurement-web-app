/**
 * ngx-ag-ui/ui - HITL Render Directive
 * 
 * Directive to register a template for Human-in-the-Loop (HITL) tool rendering.
 * Used for tools that require user interaction (e.g., confirmation, form input).
 * 
 * @example
 * ```html
 * <ng-template agHitlRender="ask_confirmation" let-args let-respond="respond">
 *   <div class="confirm-box">
 *     <p>{{ args.question }}</p>
 *     <button (click)="respond('yes')">Yes</button>
 *     <button (click)="respond('no')">No</button>
 *   </div>
 * </ng-template>
 * ```
 */
import { Directive, Input, TemplateRef, inject, OnInit, OnDestroy } from '@angular/core';
import { ToolRenderRegistry, ToolRenderContext } from '../services/tool-render-registry';

@Directive({
  selector: '[agHitlRender]',
  standalone: true,
})
export class HitlRenderDirective implements OnInit, OnDestroy {
  private readonly registry = inject(ToolRenderRegistry);
  private readonly templateRef = inject(TemplateRef<ToolRenderContext>);
  private unregister?: () => void;

  /**
   * Tool name to match (or '*' for catch-all)
   */
  @Input('agHitlRender') toolName!: string;

  /**
   * Priority (higher wins)
   */
  @Input('agHitlRenderPriority') priority = 0;

  ngOnInit() {
    if (this.toolName) {
      this.unregister = this.registry.registerHitl(
        this.toolName, 
        this.templateRef, 
        this.priority
      );
    }
  }

  ngOnDestroy() {
    this.unregister?.();
  }

  static ngTemplateContextGuard(
    dir: HitlRenderDirective,
    ctx: unknown
  ): ctx is ToolRenderContext {
    return true;
  }
}
