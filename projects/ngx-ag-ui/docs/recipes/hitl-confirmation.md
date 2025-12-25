# Recipe: HITL Confirmation Dialog

A complete example of implementing a confirmation dialog that pauses the agent until the user responds.

---

## Use Case

Agent asks user to confirm before:

- Submitting a large order
- Deleting data
- Making irreversible changes

---

## Implementation

### 1. Define the Tool (Service)

```typescript
// my-agent.service.ts
import { Injectable, inject, Injector } from '@angular/core';
import { AgAdkAdapter, AgContextService, provideTool } from 'ngx-ag-ui/core';

@Injectable({ providedIn: 'root' })
export class MyAgentService {
  private contextService = inject(AgContextService);
  private injector = inject(Injector);

  private adapter = new AgAdkAdapter({
    url: '/api/agent',
    contextService: this.contextService,
  });

  readonly activities = this.adapter.activities;

  constructor() {
    // Register HITL confirmation tool
    provideTool(
      {
        definition: {
          name: 'confirm_action',
          description:
            'Ask user to confirm a critical action before proceeding. Use for destructive or irreversible operations.',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the confirmation dialog',
              },
              message: {
                type: 'string',
                description: 'Detailed message explaining what will happen',
              },
              confirmText: {
                type: 'string',
                description: 'Text for confirm button (default: Confirm)',
              },
              cancelText: {
                type: 'string',
                description: 'Text for cancel button (default: Cancel)',
              },
            },
            required: ['title', 'message'],
          },
        },
        hitl: true, // ← Critical: marks as HITL
      },
      { injector: this.injector },
    );
  }

  async sendMessage(content: string) {
    await this.adapter.sendMessage(content, {
      tools: this.contextService.toolDefinitions(),
    });
  }

  async respond(toolCallId: string, result: unknown) {
    await this.adapter.sendHitlResponse(toolCallId, result);
  }
}
```

### 2. Create the Template (Component)

```typescript
// confirm-dialog.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HitlRenderDirective, ToolRenderOutletComponent } from 'ngx-ag-ui/ui';
import { MyAgentService } from '../services/my-agent.service';

@Component({
  selector: 'app-confirm-dialog-demo',
  standalone: true,
  imports: [CommonModule, HitlRenderDirective, ToolRenderOutletComponent],
  template: `
    <!-- HITL Template -->
    <ng-template
      agHitlRender="confirm_action"
      let-args="args"
      let-respond="respond"
      let-status="status"
      let-result="result"
    >
      <div class="dialog-overlay" [class.completed]="status === 'completed'">
        <div class="dialog">
          <!-- Header -->
          <div class="dialog-header">
            <span class="icon">⚠️</span>
            <h2>{{ args.title }}</h2>
          </div>

          <!-- Body -->
          <div class="dialog-body">
            <p>{{ args.message }}</p>
          </div>

          <!-- Actions -->
          <div class="dialog-actions">
            @if (status === 'waiting_for_user') {
              <button class="btn btn-cancel" (click)="respond({ confirmed: false })">
                {{ args.cancelText || 'Cancel' }}
              </button>
              <button class="btn btn-confirm" (click)="respond({ confirmed: true })">
                {{ args.confirmText || 'Confirm' }}
              </button>
            } @else if (status === 'completed') {
              <div class="result">
                @if (result?.confirmed) {
                  <span class="confirmed">✓ Confirmed</span>
                } @else {
                  <span class="cancelled">✗ Cancelled</span>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </ng-template>

    <!-- Outlet -->
    <ag-tool-render-outlet
      [activities]="agentService.activities"
      [onRespond]="handleRespond.bind(this)"
    />
  `,
  styles: [
    `
      .dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .dialog-overlay.completed {
        background: rgba(0, 0, 0, 0.2);
      }
      .dialog {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      }
      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .dialog-header .icon {
        font-size: 24px;
      }
      .dialog-header h2 {
        margin: 0;
        font-size: 18px;
      }
      .dialog-body {
        margin-bottom: 24px;
        color: #666;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      }
      .btn-cancel {
        background: #f0f0f0;
        color: #333;
      }
      .btn-confirm {
        background: #dc3545;
        color: white;
      }
      .result {
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 500;
      }
      .confirmed {
        color: #28a745;
      }
      .cancelled {
        color: #dc3545;
      }
    `,
  ],
})
export class ConfirmDialogDemoComponent {
  readonly agentService = inject(MyAgentService);

  handleRespond(toolCallId: string, result: unknown) {
    this.agentService.respond(toolCallId, result);
  }
}
```

### 3. Backend Configuration

```python
# backend/agent.py
from ag_ui_adk_ext import FrontendToolSet

agent = Agent(
    tools=[
        FrontendToolSet({
            "confirm_action": {}  # ← Allow this frontend tool
        })
    ]
)
```

---

## How It Works

1. User says: "Delete all my old orders"
2. Agent decides this is risky → calls `confirm_action` tool
3. Activity created with `status: 'waiting_for_user'`
4. Template renders modal dialog
5. User clicks "Confirm" or "Cancel"
6. `respond({ confirmed: true/false })` sends result to backend
7. Agent receives response and continues accordingly

---

## Variations

### Inline Confirmation (No Modal)

```html
<ng-template agHitlRender="confirm_action" let-args="args" let-respond="respond">
  <div class="inline-confirm">
    <p>{{ args.message }}</p>
    <button (click)="respond({ confirmed: true })">Yes</button>
    <button (click)="respond({ confirmed: false })">No</button>
  </div>
</ng-template>
```

### With Text Input

```html
<ng-template agHitlRender="confirm_with_notes" let-args="args" let-respond="respond">
  <div class="confirm-with-notes">
    <p>{{ args.message }}</p>
    <textarea #notes placeholder="Add notes (optional)"></textarea>
    <button (click)="respond({ confirmed: true, notes: notes.value })">Confirm</button>
  </div>
</ng-template>
```

---

## Tips

- Always mark with `hitl: true` in `provideTool`
- Use `agHitlRender`, not `agToolRender`
- Response should be an object, not a string
- Add visual feedback for completed state
- Consider accessibility (focus management, keyboard nav)
