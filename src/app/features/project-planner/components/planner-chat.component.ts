/**
 * Planner Chat Component
 * 
 * Tests ngx-ag-ui library with real ADK backend.
 * Uses Spartan UI components and existing theme.
 */
import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Spartan UI (using correct exports)
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

// Icons
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSend, lucideBot, lucideUser, lucideRotateCcw, lucideAlertCircle } from '@ng-icons/lucide';

// ngx-ag-ui
import { provideAction, provideReadable, AgContextService } from 'ngx-ag-ui/core';

// Local
import { ProjectPlannerService } from '../services/project-planner.service';
import { ActivityPanelComponent } from './activity-panel.component';

@Component({
  selector: 'app-planner-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButton,
    HlmInput,
    ...HlmCardImports,
    ...HlmIconImports,
    ...HlmSpinnerImports,
    NgIconComponent,
    ActivityPanelComponent,
  ],
  providers: [
    provideIcons({ lucideSend, lucideBot, lucideUser, lucideRotateCcw, lucideAlertCircle }),
  ],
  template: `
    <div class="flex h-full gap-4">
      <!-- Chat Panel -->
      <div class="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideBot" class="text-primary" size="16" />
            <span class="font-medium">{{ currentAgent() }}</span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Thread Selector -->
            <select 
              class="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              [ngModel]="currentThreadId()"
              (ngModelChange)="onThreadSelect($event)">
              <option [ngValue]="null">New Conversation</option>
              @for (thread of threads(); track thread.thread_id) {
                <option [value]="thread.thread_id">
                  {{ thread.title || thread.thread_id.slice(0, 8) }} 
                  ({{ thread.updated_at | date:'short' }})
                </option>
              }
            </select>

            <button hlmBtn variant="ghost" size="icon" (click)="resetChat()" title="Reset Chat">
              <ng-icon name="lucideRotateCcw" size="16" />
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-4">
          @if (messages().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ng-icon name="lucideBot" size="48" class="mb-2 opacity-50" />
              <p>Start planning your project</p>
              <p class="text-sm">Try: "Plan a mobile app for food delivery"</p>
            </div>
          }
          
          @for (msg of messages(); track msg.id) {
            <div class="flex gap-3" [class.flex-row-reverse]="msg.role === 'user'">
              <!-- Avatar -->
              <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                   [class.bg-primary]="msg.role === 'user'"
                   [class.bg-muted]="msg.role === 'assistant'">
                <ng-icon [name]="msg.role === 'user' ? 'lucideUser' : 'lucideBot'" 
                          size="16"
                          [class.text-primary-foreground]="msg.role === 'user'" />
              </div>
              
              <!-- Message -->
              <div class="flex-1 max-w-[80%]">
                <div class="rounded-lg px-4 py-2"
                     [class.bg-primary]="msg.role === 'user'"
                     [class.text-primary-foreground]="msg.role === 'user'"
                     [class.bg-muted]="msg.role === 'assistant'">
                  <p class="whitespace-pre-wrap">{{ msg.content }}</p>
                </div>
              </div>
            </div>
          }
          
          @if (isLoading()) {
            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <span hlmSpinner size="sm"></span>
              </div>
              <div class="bg-muted rounded-lg px-4 py-2">
                <span class="text-muted-foreground">Thinking...</span>
              </div>
            </div>
          }
          
          @if (error()) {
            <div class="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <ng-icon name="lucideAlertCircle" size="16" />
              <span>{{ error() }}</span>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="p-4 border-t border-border bg-muted/20">
          <form (submit)="sendMessage($event)" class="flex gap-2">
            <input hlmInput 
                   type="text" 
                   [(ngModel)]="inputValue"
                   name="message"
                   placeholder="Describe your project..."
                   class="flex-1"
                   [disabled]="isLoading()" />
            <button hlmBtn type="submit" [disabled]="!inputValue.trim() || isLoading()">
              <ng-icon name="lucideSend" size="16" />
            </button>
          </form>
        </div>
      </div>

      <!-- Activity Panel -->
      <app-activity-panel class="w-80" />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class PlannerChatComponent {
  private readonly plannerService = inject(ProjectPlannerService);
  private readonly contextService = inject(AgContextService);
  
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // State
  inputValue = '';
  
  // Computed from service
  readonly messages = computed(() => this.plannerService.messages());
  readonly isLoading = computed(() => this.plannerService.isLoading());
  readonly error = computed(() => this.plannerService.error());
  readonly currentAgent = computed(() => this.plannerService.currentAgentName());
  
  // Threads
  readonly threads = computed(() => this.plannerService.threadsResource.value() ?? []);
  readonly currentThreadId = computed(() => this.plannerService.threadId());

  constructor() {
    // Register frontend actions using ngx-ag-ui
    this.registerActions();
    
    // Share preferences as readable context
    this.registerReadables();
  }

  private registerActions(): void {
    // Test provideAction - register frontend tool handler
    provideAction({
      name: 'show_project_summary',
      description: 'Display project summary to user',
      parameters: [
        { name: 'summary', type: 'object', description: 'Project summary data' }
      ],
      handler: async ({ summary }) => {
        console.log('Project Summary:', summary);
        return { displayed: true };
      }
    });

    provideAction({
      name: 'update_project_plan',
      description: 'Update the project plan',
      parameters: [
        { name: 'plan', type: 'string', description: 'Updated project plan' }
      ],
      handler: async ({ plan }) => {
        console.log('Project Plan Updated:', plan);
        return { updated: true };
      }
    });
  }

  private registerReadables(): void {
    // Test provideReadable - share app state
    provideReadable({
      description: 'User preferences for project planning',
      value: {
        preferredMethodology: 'agile',
        teamSize: 'small',
        budgetLevel: 'medium',
      }
    });
  }

  sendMessage(event: Event): void {
    event.preventDefault();
    const content = this.inputValue.trim();
    if (!content || this.isLoading()) return;

    this.inputValue = '';
    this.plannerService.sendMessage(content);
    
    // Scroll to bottom after sending
    setTimeout(() => this.scrollToBottom(), 100);
  }

  resetChat(): void {
    this.plannerService.resetConversation();
  }

  onThreadSelect(threadId: string | null): void {
    if (threadId) {
      this.plannerService.loadHistory(threadId);
    } else {
      this.plannerService.resetConversation();
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
