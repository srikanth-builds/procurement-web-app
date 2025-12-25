/**
 * ngx-ag-ui/ui - ReadableDirective
 * 
 * Attribute directive for declaratively sharing component state with agent.
 */
import { 
  Directive, 
  Input, 
  OnInit, 
  OnDestroy, 
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { AgContextService } from '../../../../core/src/lib/services/ag-context.service';

/**
 * Directive for sharing component state with the agent.
 * 
 * @example
 * ```html
 * <!-- Share static value -->
 * <div [agReadable]="{ description: 'Selected items', value: selectedItems }">
 * 
 * <!-- Share with parent hierarchy -->
 * <div [agReadable]="{ description: 'User info', value: user }" #userCtx="agReadable">
 *   <span [agReadable]="{ description: 'User email', value: user.email }"
 *         [agReadableParent]="userCtx.contextId">
 * </div>
 * ```
 */
@Directive({
  selector: '[agReadable]',
  standalone: true,
  exportAs: 'agReadable',
})
export class ReadableDirective implements OnInit, OnDestroy, OnChanges {
  private readonly contextService = inject(AgContextService);
  
  /**
   * Context configuration
   */
  @Input({ required: true }) agReadable!: {
    description: string;
    value: unknown;
  };
  
  /**
   * Parent context ID for hierarchical context
   */
  @Input() agReadableParent?: string;
  
  /**
   * Categories for filtering
   */
  @Input() agReadableCategories?: string[];
  
  /**
   * The registered context ID (exposed for parent-child relationships)
   */
  contextId: string | null = null;

  ngOnInit(): void {
    this.register();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agReadable'] && !changes['agReadable'].firstChange) {
      // Value changed, update context
      if (this.contextId) {
        this.contextService.updateContext(
          this.contextId, 
          JSON.stringify(this.agReadable.value)
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.unregister();
  }

  private register(): void {
    this.contextId = this.contextService.addContext({
      description: this.agReadable.description,
      value: JSON.stringify(this.agReadable.value),
      parentId: this.agReadableParent,
      categories: this.agReadableCategories,
    });
  }

  private unregister(): void {
    if (this.contextId) {
      this.contextService.removeContext(this.contextId);
      this.contextId = null;
    }
  }
}
