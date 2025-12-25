/**
 * Tool Render Demo Component
 * 
 * Demonstrates ngx-ag-ui's template-based tool rendering feature.
 * Each tool type gets a custom UI via ng-template + agToolRender directive.
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmButton } from '@spartan-ng/helm/button';

// Icons
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { 
  lucideCalendar,
  lucideUsers,
  lucideListChecks,
  lucideAlertTriangle,
  lucideCheckCircle,
  lucideActivity,
  lucideUser,
  lucidePackage,
  lucideHelpCircle,
  lucideShoppingBag,
  lucideLightbulb,
  lucideTruck,
  lucideFileText,
} from '@ng-icons/lucide';

// ngx-ag-ui
import { 
  ToolRenderDirective, 
  ToolRenderOutletComponent,
  HitlRenderDirective,
} from 'ngx-ag-ui/ui';

// Local
import { ProjectPlannerService } from '../services/project-planner.service';

@Component({
  selector: 'app-tool-render-demo',
  standalone: true,
  imports: [
    CommonModule,
    ...HlmCardImports,
    ...HlmSpinnerImports,
    ...HlmIconImports,
    HlmBadge,
    HlmButton,
    NgIconComponent,
    ToolRenderDirective,
    HitlRenderDirective,
    ToolRenderOutletComponent,
  ],
  providers: [
    provideIcons({ 
      lucideCalendar,
      lucideUsers,
      lucideListChecks,
      lucideAlertTriangle,
      lucideCheckCircle,
      lucideActivity,
      lucideUser,
      lucidePackage,
      lucideHelpCircle,
      lucideShoppingBag,
      lucideLightbulb,
      lucideTruck,
      lucideFileText,
    }),
  ],
  template: `
    <!-- Register tool render templates -->
    
    <!-- Timeline Tool -->
    <ng-template 
      agToolRender="calculate_project_timeline" 
      let-args="args"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4 border-l-blue-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideCalendar" class="text-blue-500" size="18" />
          <span class="font-medium">Timeline Analysis</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['project_name']) {
          <p class="text-sm text-muted-foreground">
            Project: <strong>{{ args['project_name'] }}</strong>
          </p>
        }
        @if (result) {
          <div class="mt-2 p-2 bg-muted/50 rounded text-xs">
            <pre class="whitespace-pre-wrap overflow-hidden text-ellipsis">{{ formatResult(result) }}</pre>
          </div>
        }
      </div>
    </ng-template>

    <!-- Resource Estimation Tool -->
    <ng-template 
      agToolRender="estimate_resources" 
      let-args="args"
      let-status="status"
    >
      <div hlmCard class="p-4 border-l-4 border-l-green-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideUsers" class="text-green-500" size="18" />
          <span class="font-medium">Resource Estimation</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['team_type']) {
          <span hlmBadge variant="secondary" class="text-xs">
            Team: {{ args['team_type'] }}
          </span>
        }
      </div>
    </ng-template>

    <!-- Task Breakdown Tool -->
    <ng-template 
      agToolRender="create_task_breakdown" 
      let-args="args"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4 border-l-purple-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideListChecks" class="text-purple-500" size="18" />
          <span class="font-medium">Task Breakdown</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (result) {
          <div class="mt-2 p-2 bg-muted/50 rounded text-xs">
            <pre class="whitespace-pre-wrap">{{ formatResult(result) }}</pre>
          </div>
        }
      </div>
    </ng-template>

    <!-- Risk Analysis Tool -->
    <ng-template 
      agToolRender="analyze_project_risks" 
      let-args="args"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4 border-l-amber-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideAlertTriangle" class="text-amber-500" size="18" />
          <span class="font-medium">Risk Analysis</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (result) {
          <div class="mt-2 p-2 bg-muted/50 rounded text-xs">
            <pre class="whitespace-pre-wrap">{{ formatResult(result) }}</pre>
          </div>
        }
      </div>
    </ng-template>

    <!-- Greet User Tool -->
    <ng-template 
      agToolRender="greet_user" 
      let-args="args"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4 border-l-pink-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideUser" class="text-pink-500" size="18" />
          <span class="font-medium">Greeting User</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['name']) {
          <p class="text-sm">Hello, <strong>{{ args['name'] }}</strong>!</p>
        }
      </div>
    </ng-template>

    <!-- Process Order Tool -->
    <ng-template 
      agToolRender="process_order" 
      let-args="args"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4 border-l-orange-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucidePackage" class="text-orange-500" size="18" />
          <span class="font-medium">Order Processing</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['order_id']) {
          <p class="text-sm">Order ID: <strong>{{ args['order_id'] }}</strong></p>
        }
      </div>
    </ng-template>

    <!-- Product Options Tool -->
    <ng-template 
      agToolRender="show_products_to_user" 
      let-args="args"
      let-status="status"
    >
      <div hlmCard class="p-4 border-l-4 border-l-indigo-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideShoppingBag" class="text-indigo-500" size="18" />
          <span class="font-medium">Product Options</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['products']) {
          <div class="space-y-2 mt-2">
            @for (product of $any(args['products']); track product.name) {
              <div class="p-2 bg-muted/30 rounded text-sm border">
                <div class="font-medium">{{ product.name }}</div>
                <div class="text-xs text-muted-foreground">{{ product.description }}</div>
                <div class="flex justify-between mt-1">
                  <span class="font-bold">\${{ product.price }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-secondary">{{ product.vendor }}</span>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </ng-template>

    <!-- Suggestions Tool -->
    <ng-template 
      agToolRender="show_suggestions" 
      let-args="args"
      let-status="status"
    >
      <div hlmCard class="p-4 border-l-4 border-l-yellow-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideLightbulb" class="text-yellow-500" size="18" />
          <span class="font-medium">Suggestions</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['suggestions']) {
          <ul class="list-disc list-inside text-sm space-y-1 mt-2">
            @for (suggestion of $any(args['suggestions']); track suggestion) {
              <li>{{ suggestion }}</li>
            }
          </ul>
        }
      </div>
    </ng-template>

    <!-- Supplier List Tool -->
    <ng-template 
      agToolRender="supplier_list" 
      let-args="args"
      let-status="status"
    >
      <div hlmCard class="p-4 border-l-4 border-l-cyan-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideTruck" class="text-cyan-500" size="18" />
          <span class="font-medium">Supplier List</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args?.['suppliers']) {
          <div class="space-y-2 mt-2">
            @for (supplier of $any(args['suppliers']); track supplier.id) {
              <div class="flex justify-between items-center p-2 bg-muted/30 rounded text-sm">
                <div>
                  <div class="font-medium">{{ supplier.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ supplier.location }}</div>
                </div>
                <div class="text-right">
                  <div class="font-bold">★ {{ supplier.rating }}</div>
                  <div class="text-xs">{{ supplier.status }}</div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </ng-template>

    <!-- Update PR Tool -->
    <ng-template 
      agToolRender="update_pr_state" 
      let-args="args"
      let-status="status"
    >
      <div hlmCard class="p-4 border-l-4 border-l-slate-500">
        <div class="flex items-center gap-2 mb-2">
          <ng-icon name="lucideFileText" class="text-slate-500" size="18" />
          <span class="font-medium">Update PR</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
          }
        </div>
        @if (args) {
          <div class="text-sm">
            <p>Action: <span class="font-mono bg-muted px-1 rounded">{{ args['action'] || 'add' }}</span></p>
            @if ($any(args['items'])?.length) {
              <p class="mt-1 text-muted-foreground">Items: {{ $any(args['items']).length }}</p>
            }
          </div>
        }
      </div>
    </ng-template>

    <!-- HITL: Ask User Confirmation -->
    <ng-template 
      agHitlRender="ask_user_confirmation" 
      let-args="args"
      let-respond="respond"
      let-status="status"
      let-result="result"
    >
      <div hlmCard class="p-4 border-l-4" 
           [class.border-l-red-500]="status !== 'completed'" 
           [class.bg-red-50/50]="status !== 'completed'" 
           [class.border-l-green-500]="status === 'completed'">
        
        <div class="flex items-center gap-2 mb-3">
          @if (status === 'completed') {
             <ng-icon name="lucideCheckCircle" class="text-green-500" size="18" />
             <span class="font-medium text-green-700">Confirmation Completed</span>
          } @else {
             <ng-icon name="lucideHelpCircle" class="text-red-500" size="18" />
             <span class="font-medium text-red-700">Confirmation Required</span>
          }
        </div>
        
        <p class="text-sm mb-4">{{ args?.['descriptive_action'] || 'Are you sure you want to proceed?' }}</p>
        
        @if (status === 'completed') {
            <div class="text-sm font-medium p-2 bg-white/50 rounded border">
                Result: <span [class.text-green-600]="result === 'Yes'" [class.text-red-600]="result === 'No'">{{ result }}</span>
            </div>
        } @else {
            <div class="flex gap-2">
              <button hlmBtn size="sm" variant="destructive" (click)="onHitlRespond(respond, 'No')">
                Reject
              </button>
              <button hlmBtn size="sm" (click)="onHitlRespond(respond, 'Yes')">
                Approve
              </button>
            </div>
        }
      </div>
    </ng-template>

    <!-- Catch-all template for other tools -->
    <ng-template 
      agToolRender="*" 
      let-toolName="toolName"
      let-title="title"
      let-status="status"
    >
      <div hlmCard class="p-3 border-l-4 border-l-gray-400">
        <div class="flex items-center gap-2">
          <ng-icon name="lucideActivity" class="text-muted-foreground" size="16" />
          <span class="font-medium text-sm">{{ title || toolName }}</span>
          @if (status === 'running') {
            <span hlmSpinner size="sm"></span>
          } @else if (status === 'completed') {
            <ng-icon name="lucideCheckCircle" class="text-green-500" size="14" />
          }
        </div>
      </div>
    </ng-template>

    <!-- Outlet renders matching templates for activities -->
    <div class="space-y-3 p-3">
      <h3 class="text-sm font-medium text-muted-foreground mb-2">
        Tool Renders (ngx-ag-ui)
      </h3>
      <ag-tool-render-outlet 
        [activities]="plannerService.activities"
        filter="with-template"
        [onRespond]="handleRespond.bind(this)"
      />
      
      @if (plannerService.activities().length === 0) {
        <p class="text-sm text-muted-foreground text-center py-4">
          Send a message to see tool renders...
        </p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ToolRenderDemoComponent {
  readonly plannerService = inject(ProjectPlannerService);

  formatResult(result: unknown): string {
    if (!result) return '';
    try {
      const str = JSON.stringify(result, null, 2);
      return str.length > 200 ? str.slice(0, 200) + '...' : str;
    } catch {
      return String(result);
    }
  }

  onHitlRespond(respond: ((result: unknown) => void) | undefined, value: string): void {
    if (respond) {
      respond(value);
    }
  }

  handleRespond(toolCallId: string, result: unknown): void {
    this.plannerService.submitUserResponse(toolCallId, result);
  }
}
