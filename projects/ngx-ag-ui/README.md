# ngx-ag-ui

**Angular library for building AI agent-powered applications with AG-UI protocol support.**

Build rich, interactive AI chat interfaces with tool rendering, human-in-the-loop (HITL) interactions, and real-time state management.

---

## Features

- 🔧 **Tool Rendering** - Custom UI for agent tool calls via Angular templates
- 🧑‍💻 **Human-in-the-Loop (HITL)** - Interactive components for agent confirmations
- 📡 **Real-time Streaming** - Server-sent events for progressive responses
- 🔄 **State Management** - Reactive signals for messages, activities, and custom state
- 🎯 **AG-UI Protocol** - Compatible with Google ADK and AG-UI standard
- 📦 **Modular** - Use core primitives or pre-built UI components

---

## Quick Start

### 1. Install

```bash
npm install ngx-ag-ui
```

### 2. Create an Agent Service

```typescript
import { Injectable, inject, Injector } from '@angular/core';
import { AgAdkAdapter, AgContextService, provideTool } from 'ngx-ag-ui/core';

@Injectable({ providedIn: 'root' })
export class MyAgentService {
  private contextService = inject(AgContextService);
  private injector = inject(Injector);

  private adapter = new AgAdkAdapter({
    url: '/api/my-agent',
    contextService: this.contextService,
  });

  // Expose signals for your components
  readonly messages = this.adapter.messages;
  readonly activities = this.adapter.activities;
  readonly isLoading = this.adapter.isLoading;

  constructor() {
    // Register frontend tools
    provideTool(
      {
        definition: {
          name: 'confirm_action',
          description: 'Ask user for confirmation',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
        hitl: true, // Mark as human-in-the-loop
      },
      { injector: this.injector },
    );
  }

  async sendMessage(content: string) {
    await this.adapter.sendMessage(content, {
      tools: this.contextService.toolDefinitions(),
    });
  }

  async respondToHitl(toolCallId: string, response: unknown) {
    await this.adapter.sendHitlResponse(toolCallId, response);
  }
}
```

### 3. Add Tool Templates

```typescript
import { Component, inject } from '@angular/core';
import { ToolRenderDirective, HitlRenderDirective, ToolRenderOutletComponent } from 'ngx-ag-ui/ui';
import { MyAgentService } from './my-agent.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ToolRenderDirective, HitlRenderDirective, ToolRenderOutletComponent],
  template: `
    <!-- HITL Template: Shows when tool needs user input -->
    <ng-template
      agHitlRender="confirm_action"
      let-args="args"
      let-respond="respond"
      let-status="status"
    >
      @if (status === 'waiting_for_user') {
        <div class="confirmation-card">
          <p>{{ args.message }}</p>
          <button (click)="respond('approved')">Approve</button>
          <button (click)="respond('rejected')">Reject</button>
        </div>
      } @else {
        <p>Response submitted ✓</p>
      }
    </ng-template>

    <!-- Tool Render Outlet: Renders all tool activities -->
    <ag-tool-render-outlet
      [activities]="agentService.activities"
      [onRespond]="handleRespond.bind(this)"
    />
  `,
})
export class ChatComponent {
  agentService = inject(MyAgentService);

  handleRespond(toolCallId: string, result: unknown) {
    this.agentService.respondToHitl(toolCallId, result);
  }
}
```

---

## Documentation

| Guide                                                 | Description                     |
| ----------------------------------------------------- | ------------------------------- |
| [Quick Start](./docs/guides/quick-start.md)           | Get up and running in 5 minutes |
| [Core Concepts](./docs/guides/core-concepts.md)       | Understand the architecture     |
| [State Management](./docs/guides/state-management.md) | Working with agent state        |
| [HITL Tools](./docs/guides/hitl-tools.md)             | Human-in-the-loop interactions  |
| [Recipes](./docs/recipes/)                            | Common patterns and examples    |
| [Troubleshooting](./docs/troubleshooting/)            | Common mistakes and solutions   |
| [API Reference](./docs/api/)                          | Complete API documentation      |

---

## Packages

| Package          | Description                            |
| ---------------- | -------------------------------------- |
| `ngx-ag-ui/core` | Core services, adapters, and functions |
| `ngx-ag-ui/ui`   | UI components and directives           |

---

## Requirements

- Angular 17+
- TypeScript 5+
- Backend supporting AG-UI protocol (e.g., Google ADK)

---

## License

MIT
