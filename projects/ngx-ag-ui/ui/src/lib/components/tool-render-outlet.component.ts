/**
 * ngx-ag-ui/ui - ToolRenderOutlet
 * 
 * Component that renders tool calls using registered templates.
 * Connects to an adapter's activities and renders matching templates.
 * 
 * @example
 * ```html
 * <!-- Register templates -->
 * <ng-template agToolRender="get_weather" let-args="args">
 *   <weather-card [location]="args.location" />
 * </ng-template>
 * 
 * <!-- Outlet renders matching tool calls -->
 * <ag-tool-render-outlet [activities]="adapter.activities()" />
 * ```
 */
import { 
  Component, 
  Input, 
  inject,
  computed,
  Signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ToolRenderRegistry, ToolRenderContext } from '../services/tool-render-registry';
import { Activity } from '../../../../core/src/lib/adapters/ag-adk-adapter';

/**
 * Which activities to render
 */
export type RenderFilter = 'all' | 'running' | 'completed' | 'with-template';



/**
 * Outlet component for rendering tool calls
 */
@Component({
  selector: 'ag-tool-render-outlet',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (activity of filteredActivities(); track activity.id) {
      @if (getTemplate(activity); as template) {
        <ng-container 
          *ngTemplateOutlet="template; context: getContext(activity)"
        />
      }
    }
  `,
})
export class ToolRenderOutletComponent {
  private readonly registry = inject(ToolRenderRegistry);
  
  /**
   * Track responded tool calls to prevent double-submit
   */
  private respondedToolCalls = new Set<string>();

  /**
   * Activities to render (from adapter)
   */
  @Input({ required: true }) activities!: Activity[] | Signal<Activity[]>;
  
  /**
   * Filter which activities to show
   */
  @Input() filter: RenderFilter = 'with-template';
  
  /**
   * Only show specific tools (empty = all)
   */
  @Input() onlyTools: string[] = [];
  
  /**
   * Exclude specific tools
   */
  @Input() excludeTools: string[] = [];
  
  /**
   * Respond callback for HITL
   */
  @Input() onRespond?: (toolCallId: string, result: unknown) => void;
  
  /**
   * Enable debug logging
   */
  @Input() debug = false;

  /**
   * Activities after filtering
   */
  readonly filteredActivities = computed(() => {
    const activities = this.getActivities();
    
    if (this.debug) {
      console.log('[ngx-ag-ui/outlet] filteredActivities - all activities:', 
        activities.map(a => ({ id: a.id, tool: a.tool, status: a.status }))
      );
    }
    
    const result = activities.filter(activity => {
      // Filter by status
      if (this.filter === 'running' && activity.status !== 'running') return false;
      if (this.filter === 'completed' && activity.status !== 'completed') return false;
      
      // Check if has template
      const hasTemplate = this.registry.hasTemplate(activity.tool);
      
      if (this.debug) {
        console.log('[ngx-ag-ui/outlet] hasTemplate check:', { 
          tool: activity.tool, 
          hasTemplate, 
          filter: this.filter,
          status: activity.status
        });
      }
      
      if (this.filter === 'with-template' && !hasTemplate) return false;
      
      // Filter by tool name
      if (this.onlyTools.length > 0 && !this.onlyTools.includes(activity.tool)) return false;
      if (this.excludeTools.includes(activity.tool)) return false;
      
      return true;
    });
    
    if (this.debug) {
      console.log('[ngx-ag-ui/outlet] Filtered result:', result.length, 'activities');
    }
    return result;
  });

  /**
   * Get template for an activity
   */
  getTemplate(activity: Activity) {
    if (this.debug) {
      console.log('[ngx-ag-ui/outlet] getTemplate called', { 
        tool: activity.tool, 
        status: activity.status,
        id: activity.id 
      });
    }
    
    // HITL tools have 'waiting_for_user' status - use HITL template
    if (activity.status === 'waiting_for_user') {
      const hitlTemplate = this.registry.getHitlTemplate(activity.tool);
      
      if (this.debug) {
        console.log('[ngx-ag-ui/outlet] HITL template lookup', { 
          tool: activity.tool, 
          hasHitlTemplate: !!hitlTemplate 
        });
      }
      
      if (hitlTemplate) {
        return hitlTemplate;
      }
    }
    
    // Fallback to regular template
    const template = this.registry.getTemplate(activity.tool);
    
    // If no regular template, try HITL template again (it might be a completed HITL tool)
    if (!template) {
        const hitlTemplate = this.registry.getHitlTemplate(activity.tool);
        if (hitlTemplate) return hitlTemplate;
    }
    
    if (this.debug) {
      console.log('[ngx-ag-ui/outlet] Regular template lookup', { 
        tool: activity.tool, 
        hasTemplate: !!template 
      });
    }
    
    return template;
  }

  /**
   * Build context for template
   */
  getContext(activity: Activity): ToolRenderContext {
    // Check if already responded to prevent double-submit
    const hasResponded = this.respondedToolCalls.has(activity.id);
    
    const ctx: Omit<ToolRenderContext, '$implicit'> = {
      toolCallId: activity.id,
      toolName: activity.tool,
      args: activity.args ?? {},
      status: activity.status,
      result: activity.result,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp,
      agentName: activity.agentName,
      // If already responded, don't provide respond callback
      respond: (this.onRespond && !hasResponded)
        ? (result: unknown) => {
            this.respondedToolCalls.add(activity.id);
            this.onRespond!(activity.id, result);
          }
        : undefined,
    };
    // Set $implicit to self for let-ctx binding
    return { ...ctx, $implicit: ctx as ToolRenderContext };
  }

  /**
   * Get activities array (handles both array and Signal inputs)
   */
  private getActivities(): Activity[] {
    if (typeof this.activities === 'function') {
      return this.activities();
    }
    return this.activities;
  }
}
