/**
 * ngx-ag-ui/ui - ActionRenderDirective
 * 
 * Structural directive for dynamically rendering action UI.
 * Works with AgContextService to render registered action components.
 */
import { 
  Directive, 
  Input, 
  TemplateRef, 
  ViewContainerRef, 
  inject,
  OnInit,
  OnDestroy,
  Type,
  ComponentRef,
  EmbeddedViewRef,
} from '@angular/core';
import { AgContextService } from '../../../../core/src/lib/services/ag-context.service';
import { RegisteredAction, ActionRenderProps } from '../../../../core/src/lib/types/actions';

/**
 * Directive for rendering action UI dynamically based on tool calls.
 * 
 * @example
 * ```html
 * <!-- Render specific action -->
 * <ng-container *agActionRender="'confirmPurchase'; args: toolCallArgs; status: status">
 *   <confirmation-dialog [amount]="args.amount" (confirm)="respond('yes')">
 *   </confirmation-dialog>
 * </ng-container>
 * ```
 */
@Directive({
  selector: '[agActionRender]',
  standalone: true,
})
export class ActionRenderDirective implements OnInit, OnDestroy {
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly contextService = inject(AgContextService);
  private readonly templateRef = inject(TemplateRef<ActionRenderContext>, { optional: true });
  
  private componentRef: ComponentRef<unknown> | null = null;
  private embeddedView: EmbeddedViewRef<ActionRenderContext> | null = null;
  
  /**
   * Action name to render
   */
  @Input({ required: true }) agActionRender!: string;
  
  /**
   * Arguments for the action
   */
  @Input() agActionRenderArgs: Record<string, unknown> = {};
  
  /**
   * Current status
   */
  @Input() agActionRenderStatus: 'pending' | 'executing' | 'complete' | 'error' = 'pending';
  
  /**
   * Result (if complete)
   */
  @Input() agActionRenderResult?: unknown;
  
  /**
   * Respond callback
   */
  @Input() agActionRenderRespond?: (result: unknown) => void;

  ngOnInit(): void {
    this.render();
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private render(): void {
    const action = this.contextService.getActionByName(this.agActionRender);
    
    if (!action?.render) {
      // No custom render, use template if provided
      if (this.templateRef) {
        this.renderTemplate();
      }
      return;
    }
    
    // Check render type
    if (typeof action.render === 'function' && !this.isComponent(action.render)) {
      // Function renderer - returns string
      const result = (action.render as Function)({
        name: this.agActionRender,
        args: this.agActionRenderArgs,
        status: this.agActionRenderStatus,
        result: this.agActionRenderResult,
        respond: this.agActionRenderRespond,
      });
      
      // TODO: Handle string result
    } else if (this.isComponent(action.render)) {
      // Component renderer
      this.renderComponent(action.render as Type<unknown>);
    } else {
      // TemplateRef renderer
      this.renderCustomTemplate(action.render as TemplateRef<ActionRenderProps>);
    }
  }

  private renderTemplate(): void {
    if (!this.templateRef) return;
    
    const context: ActionRenderContext = {
      $implicit: this.agActionRenderArgs,
      name: this.agActionRender,
      args: this.agActionRenderArgs,
      status: this.agActionRenderStatus,
      result: this.agActionRenderResult,
      respond: this.agActionRenderRespond ?? (() => {}),
    };
    
    this.embeddedView = this.viewContainer.createEmbeddedView(this.templateRef, context);
  }

  private renderComponent(component: Type<unknown>): void {
    this.componentRef = this.viewContainer.createComponent(component);
    
    // Set inputs if the component has them
    const instance = this.componentRef.instance as Record<string, unknown>;
    if ('args' in instance) instance['args'] = this.agActionRenderArgs;
    if ('status' in instance) instance['status'] = this.agActionRenderStatus;
    if ('result' in instance) instance['result'] = this.agActionRenderResult;
    if ('respond' in instance) instance['respond'] = this.agActionRenderRespond;
  }

  private renderCustomTemplate(template: TemplateRef<ActionRenderProps>): void {
    const context: ActionRenderProps = {
      name: this.agActionRender,
      args: this.agActionRenderArgs,
      status: this.agActionRenderStatus,
      result: this.agActionRenderResult,
      respond: this.agActionRenderRespond,
    };
    
    this.viewContainer.createEmbeddedView(template, context);
  }

  private clear(): void {
    this.viewContainer.clear();
    this.componentRef = null;
    this.embeddedView = null;
  }

  private isComponent(value: unknown): value is Type<unknown> {
    return typeof value === 'function' && value.prototype !== undefined;
  }
}

/**
 * Template context for action render
 */
export interface ActionRenderContext {
  $implicit: Record<string, unknown>;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'executing' | 'complete' | 'error';
  result?: unknown;
  respond: (result: unknown) => void;
}
