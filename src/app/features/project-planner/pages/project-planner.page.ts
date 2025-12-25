/**
 * Project Planner Page
 * 
 * Main page wrapper for the project planner feature.
 * Demonstrates ngx-ag-ui library features.
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerChatComponent } from '../components/planner-chat.component';
import { ToolRenderDemoComponent } from '../components/tool-render-demo.component';

@Component({
  selector: 'app-project-planner-page',
  standalone: true,
  imports: [CommonModule, PlannerChatComponent, ToolRenderDemoComponent],
  template: `
    <div class="h-full flex flex-col p-6">
      <!-- Header -->
      <div class="mb-4">
        <h1 class="text-2xl font-bold">Project Planner</h1>
        <p class="text-muted-foreground">AI-powered project planning with multi-agent collaboration</p>
      </div>
      
      <!-- Main Content: Chat + Tool Renders -->
      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Chat (takes 2/3) -->
        <div class="lg:col-span-2 h-full">
          <app-planner-chat />
        </div>
        
        <!-- Tool Renders (takes 1/3) -->
        <div class="h-full overflow-y-auto rounded-lg border border-border bg-card">
          <div class="p-3 border-b border-border sticky top-0 bg-card z-10">
            <h2 class="font-medium text-sm">Tool Visualizations</h2>
            <p class="text-xs text-muted-foreground">Custom UI via ngx-ag-ui templates</p>
          </div>
          <app-tool-render-demo />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class ProjectPlannerPage {}

