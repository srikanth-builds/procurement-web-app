/**
 * Activity Panel Component
 * 
 * Displays tool call activities and their status.
 * Tests ngx-ag-ui's activity tracking features.
 */
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

// Spartan UI (using correct exports)
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmBadge } from '@spartan-ng/helm/badge';

// Icons
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { 
  lucideActivity, 
  lucideCheckCircle, 
  lucideXCircle, 
  lucideCalendar,
  lucideUsers,
  lucideListChecks,
  lucideAlertTriangle,
  lucideFileText,
} from '@ng-icons/lucide';

// Local
import { ProjectPlannerService } from '../services/project-planner.service';
import { Activity } from 'ngx-ag-ui/core';

@Component({
  selector: 'app-activity-panel',
  standalone: true,
  imports: [
    CommonModule,
    ...HlmCardImports,
    ...HlmIconImports,
    ...HlmSpinnerImports,
    HlmBadge,
    NgIconComponent,
  ],
  providers: [
    provideIcons({ 
      lucideActivity, 
      lucideCheckCircle, 
      lucideXCircle, 
      lucideCalendar,
      lucideUsers,
      lucideListChecks,
      lucideAlertTriangle,
      lucideFileText,
    }),
  ],
  template: `
    <section hlmCard class="h-full flex flex-col">
      <!-- Header -->
      <header hlmCardHeader class="border-b border-border py-3">
        <div class="flex items-center gap-2">
          <ng-icon name="lucideActivity" class="text-primary" size="16" />
          <span class="font-medium">Activity</span>
          @if (activities().length > 0) {
            <span class="text-xs text-muted-foreground ml-auto">
              {{ activities().length }} actions
            </span>
          }
        </div>
      </header>

      <!-- Activities List -->
      <div hlmCardContent class="flex-1 overflow-y-auto p-3 space-y-2">
        @if (activities().length === 0) {
          <div class="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <ng-icon name="lucideActivity" size="32" class="mb-2 opacity-30" />
            <p class="text-sm">No activities yet</p>
          </div>
        }

        @for (activity of activities(); track activity.id) {
          <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <!-- Status Icon -->
            <div class="flex-shrink-0 mt-0.5">
              @switch (activity.status) {
                @case ('running') {
                  <span hlmSpinner size="sm"></span>
                }
                @case ('completed') {
                  <ng-icon name="lucideCheckCircle" class="text-green-500" size="16" />
                }
                @case ('failed') {
                  <ng-icon name="lucideXCircle" class="text-destructive" size="16" />
                }
              }
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <ng-icon [name]="getToolIcon(activity.tool)" size="12" class="text-muted-foreground" />
                <span class="font-medium text-sm truncate">{{ activity.title }}</span>
              </div>
              @if (activity.description) {
                <p class="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {{ activity.description }}
                </p>
              }
              <div class="flex items-center gap-2 mt-1">
                <span hlmBadge variant="outline" class="text-xs">
                  {{ formatToolName(activity.tool) }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ formatTime(activity.timestamp) }}
                </span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Project State Preview -->
      @if (hasProjectState()) {
        <div class="border-t border-border p-3">
          <div class="flex items-center gap-2 mb-2">
            <ng-icon name="lucideFileText" size="16" class="text-primary" />
            <span class="text-sm font-medium">Project Plan</span>
          </div>
          <div class="text-xs text-muted-foreground bg-muted/50 p-2 rounded max-h-24 overflow-y-auto">
            <pre class="whitespace-pre-wrap">{{ projectStatePreview() }}</pre>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class ActivityPanelComponent {
  private readonly plannerService = inject(ProjectPlannerService);

  // Computed
  readonly activities = computed(() => 
    [...this.plannerService.activities()].reverse()
  );
  
  readonly hasProjectState = computed(() => 
    Object.keys(this.plannerService.projectState()).length > 0
  );
  
  readonly projectStatePreview = computed(() => 
    JSON.stringify(this.plannerService.projectState(), null, 2).slice(0, 300)
  );

  getToolIcon(tool: string): string {
    const icons: Record<string, string> = {
      'calculate_project_timeline': 'lucideCalendar',
      'estimate_resources': 'lucideUsers',
      'create_task_breakdown': 'lucideListChecks',
      'analyze_project_risks': 'lucideAlertTriangle',
    };
    return icons[tool] ?? 'lucideActivity';
  }

  formatToolName(tool: string): string {
    return tool.split('_').slice(0, 2).join(' ');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
