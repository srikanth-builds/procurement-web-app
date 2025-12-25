# Quick Start Guide

Get your first AI agent chat working in Angular in under 10 minutes.

---

## Prerequisites

- Angular 17+
- Node.js 18+
- A backend running AG-UI compatible agent (Google ADK, LangGraph, etc.)

---

## Step 1: Install

```bash
npm install ngx-ag-ui
```

---

## Step 2: Create Agent Service

Create a service to manage your agent connection:

```typescript
// src/app/services/chat-agent.service.ts

import { Injectable, inject, Injector, OnDestroy } from '@angular/core';
import { AgAdkAdapter, AgContextService, provideTool } from 'ngx-ag-ui/core';

@Injectable({ providedIn: 'root' })
export class ChatAgentService implements OnDestroy {
  private contextService = inject(AgContextService);
  private injector = inject(Injector);

  // Create adapter for your backend
  private adapter = new AgAdkAdapter({
    url: 'http://localhost:8000/api/agent', // Your backend URL
    contextService: this.contextService,
    debug: true, // See events in console
  });

  // Expose state as signals
  readonly messages = this.adapter.messages;
  readonly activities = this.adapter.activities;
  readonly isLoading = this.adapter.isLoading;
  readonly error = this.adapter.error;

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    // Register a HITL tool for confirmations
    provideTool(
      {
        definition: {
          name: 'ask_confirmation',
          description: 'Ask user for confirmation before proceeding',
          parameters: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The question to ask the user',
              },
            },
            required: ['question'],
          },
        },
        hitl: true,
      },
      { injector: this.injector },
    );
  }

  async sendMessage(content: string): Promise<void> {
    await this.adapter.sendMessage(content, {
      tools: this.contextService.toolDefinitions(),
    });
  }

  async respondToHitl(toolCallId: string, response: string): Promise<void> {
    await this.adapter.sendHitlResponse(toolCallId, response);
  }

  ngOnDestroy() {
    this.adapter.destroy();
  }
}
```

---

## Step 3: Create Chat Component

```typescript
// src/app/components/chat/chat.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolRenderDirective, HitlRenderDirective, ToolRenderOutletComponent } from 'ngx-ag-ui/ui';
import { ChatAgentService } from '../../services/chat-agent.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToolRenderDirective,
    HitlRenderDirective,
    ToolRenderOutletComponent,
  ],
  template: `
    <div class="chat-container">
      <!-- Messages -->
      <div class="messages">
        @for (msg of agentService.messages(); track msg.id) {
          <div class="message" [class]="msg.role">
            {{ msg.content }}
          </div>
        }

        @if (agentService.isLoading()) {
          <div class="message assistant loading">Thinking...</div>
        }
      </div>

      <!-- Tool Renders -->
      <div class="tools">
        <!-- HITL Template for confirmations -->
        <ng-template
          agHitlRender="ask_confirmation"
          let-args="args"
          let-respond="respond"
          let-status="status"
        >
          @if (status === 'waiting_for_user') {
            <div class="confirmation-card">
              <p>{{ args.question }}</p>
              <div class="buttons">
                <button (click)="respond('yes')">Yes</button>
                <button (click)="respond('no')">No</button>
              </div>
            </div>
          } @else {
            <div class="completed">✓ Response submitted</div>
          }
        </ng-template>

        <!-- Render tool activities -->
        <ag-tool-render-outlet
          [activities]="agentService.activities"
          [onRespond]="handleRespond.bind(this)"
        />
      </div>

      <!-- Input -->
      <div class="input-area">
        <input [(ngModel)]="inputText" (keyup.enter)="send()" placeholder="Type a message..." />
        <button (click)="send()" [disabled]="agentService.isLoading()">Send</button>
      </div>
    </div>
  `,
  styles: [
    `
      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-width: 600px;
        margin: 0 auto;
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      .message {
        padding: 0.75rem 1rem;
        margin: 0.5rem 0;
        border-radius: 1rem;
      }
      .message.user {
        background: #007bff;
        color: white;
        margin-left: 20%;
      }
      .message.assistant {
        background: #f0f0f0;
        margin-right: 20%;
      }
      .tools {
        padding: 1rem;
      }
      .confirmation-card {
        background: #fff3cd;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #ffc107;
      }
      .buttons {
        margin-top: 0.5rem;
      }
      .buttons button {
        margin-right: 0.5rem;
        padding: 0.5rem 1rem;
      }
      .input-area {
        display: flex;
        padding: 1rem;
        border-top: 1px solid #ddd;
      }
      .input-area input {
        flex: 1;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 0.25rem;
      }
      .input-area button {
        margin-left: 0.5rem;
        padding: 0.75rem 1.5rem;
      }
    `,
  ],
})
export class ChatComponent {
  readonly agentService = inject(ChatAgentService);
  inputText = '';

  async send() {
    if (!this.inputText.trim()) return;

    const message = this.inputText;
    this.inputText = '';

    await this.agentService.sendMessage(message);
  }

  handleRespond(toolCallId: string, result: unknown) {
    this.agentService.respondToHitl(toolCallId, result as string);
  }
}
```

---

## Step 4: Backend Configuration

Your backend needs to accept the `ask_confirmation` tool.

### For Google ADK (Python):

```python
from ag_ui_adk_ext import ExtendedADKAgent, FrontendToolSet

agent = ExtendedADKAgent(
    adk_agent=your_agent,
    tools=[
        # Allow frontend to send this tool
        FrontendToolSet({"ask_confirmation": {}})
    ]
)
```

---

## Step 5: Test It!

1. Start your backend
2. Run `ng serve`
3. Open http://localhost:4200
4. Try: "Can you confirm something for me?"

The agent should:

1. Call the `ask_confirmation` tool
2. Your HITL template renders with Yes/No buttons
3. You click a button
4. Agent receives your response and continues

---

## What's Next?

- [Core Concepts](./core-concepts.md) - Understand the architecture
- [HITL Tools](./hitl-tools.md) - More on human-in-the-loop
- [Recipes](../recipes/) - Common patterns
- [Troubleshooting](../troubleshooting/) - Common issues
