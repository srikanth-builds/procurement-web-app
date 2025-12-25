# Core Concepts

This guide explains the fundamental concepts of ngx-ag-ui for developers new to building AI agent-powered applications.

---

## Table of Contents

1. [What is an AI Agent?](#what-is-an-ai-agent)
2. [Architecture Overview](#architecture-overview)
3. [State Management](#state-management)
4. [Getting Responses from the Agent](#getting-responses-from-the-agent)
5. [Tool Activities](#tool-activities)
6. [HITL (Human-in-the-Loop)](#hitl-human-in-the-loop)
7. [Tool Definitions vs Templates](#tool-definitions-vs-templates)
8. [Services & Adapters](#services--adapters)

---

## What is an AI Agent?

An **AI Agent** is an LLM (Large Language Model) that can:

1. **Respond** to user messages with text
2. **Call tools** to perform actions (search, calculate, update UI)
3. **Request human input** when needed (confirmations, choices)

```
User: "Add 5 laptops to my purchase request"
      ↓
Agent: [thinks] → "I should use the update_pr tool"
      ↓
Tool Call: update_pr({ items: [{name: "laptop", qty: 5}] })
      ↓
Agent: "Done! I've added 5 laptops to your PR."
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR ANGULAR APP                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │  YourComponent   │    │     YourAgentService         │   │
│  │                  │    │                              │   │
│  │  - Templates     │───▶│  - AgAdkAdapter (state)      │   │
│  │  - UI bindings   │    │  - AgContextService (tools)  │   │
│  └──────────────────┘    └──────────────┬───────────────┘   │
│                                         │                    │
└─────────────────────────────────────────┼────────────────────┘
                                          │ HTTP/SSE
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Python)                        │
│  - Google ADK Agent                                          │
│  - FrontendToolSet (accepts frontend tools)                  │
│  - Emits AG-UI events                                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component              | Role                                                           |
| ---------------------- | -------------------------------------------------------------- |
| **AgAdkAdapter**       | Manages ONE agent endpoint. Holds messages, activities, state. |
| **AgContextService**   | Global registry for tool definitions and context.              |
| **ToolRenderRegistry** | Stores UI templates for tool visualization.                    |
| **Backend Agent**      | The actual LLM that processes requests.                        |

---

## State Management

ngx-ag-ui uses **Angular Signals** for reactive state management.

### Available State

```typescript
// In your service
private adapter = new AgAdkAdapter({ url: '/api/agent', ... });

// Expose these signals to components
readonly messages = this.adapter.messages;        // All chat messages
readonly activities = this.adapter.activities;    // Tool call activities
readonly isLoading = this.adapter.isLoading;      // Loading indicator
readonly customState = this.adapter.customState;  // Backend state
readonly threadId = this.adapter.threadId;        // Conversation ID
readonly error = this.adapter.error;              // Error messages
```

### Accessing State in Components

```typescript
@Component({
  template: `
    <!-- Display messages -->
    @for (msg of agentService.messages(); track msg.id) {
      <div [class]="msg.role">{{ msg.content }}</div>
    }

    <!-- Show loading -->
    @if (agentService.isLoading()) {
      <spinner />
    }

    <!-- Access custom state from backend -->
    <pre>{{ agentService.customState() | json }}</pre>
  `,
})
export class ChatComponent {
  agentService = inject(MyAgentService);
}
```

### Custom State from Backend

The backend can send state updates via `STATE_SNAPSHOT` or `STATE_DELTA` events:

```python
# Backend sends state
emit_state_snapshot({"project_plan": {...}, "user_preferences": {...}})
```

```typescript
// Frontend receives it automatically
this.adapter.customState();
// → { project_plan: {...}, user_preferences: {...} }
```

### Adding Context (Readable Data)

Provide context to the agent about your app's state:

```typescript
// In your component
import { provideReadable } from 'ngx-ag-ui/core';

// Register readable context
provideReadable({
  description: 'Current shopping cart contents',
  value: () => this.cartService.items(),
});
```

The agent will see this context when making decisions.

---

## Getting Responses from the Agent

### Sending a Message

```typescript
async sendMessage(content: string) {
  await this.adapter.sendMessage(content, {
    tools: this.contextService.toolDefinitions(),
    context: this.contextService.contextItems(),
  });
}
```

### Response Flow

1. **User sends message** → `sendMessage('Hello')`
2. **Backend processes** → Streams events via SSE
3. **Events received**:
   - `RUN_STARTED` - Agent started processing
   - `TEXT_MESSAGE_START` - Agent begins responding
   - `TEXT_MESSAGE_CONTENT` - Streamed text chunks
   - `TEXT_MESSAGE_END` - Response complete
   - `RUN_FINISHED` - Agent done

### Accessing the Response

```typescript
// All messages including agent responses
const messages = this.adapter.messages();

// Last assistant message
const lastMessage = messages.findLast((m) => m.role === 'assistant');
console.log(lastMessage?.content); // "Here's what I found..."
```

### Reactive Updates

Since `messages` is a signal, your UI updates automatically:

```html
@for (msg of agentService.messages(); track msg.id) { @if (msg.role === 'user') {
<div class="user-bubble">{{ msg.content }}</div>
} @else {
<div class="assistant-bubble">{{ msg.content }}</div>
} }
```

---

## Tool Activities

When the agent calls a tool, an **Activity** is created to track it.

### Activity Lifecycle

```
TOOL_CALL_START   →   "Tool X started"
      ↓
TOOL_CALL_ARGS    →   "Received arguments: {...}"
      ↓
TOOL_CALL_END     →   "Tool execution completed"
      ↓
TOOL_CALL_RESULT  →   "Result: {...}"
```

### Activity Status

| Status             | Meaning                          |
| ------------------ | -------------------------------- |
| `pending`          | Tool call initiated              |
| `running`          | Tool is executing                |
| `completed`        | Tool finished successfully       |
| `failed`           | Tool encountered an error        |
| `waiting_for_user` | HITL tool waiting for user input |

### Accessing Activities

```typescript
// All activities
const activities = this.adapter.activities();

// Filter by status
const running = activities.filter((a) => a.status === 'running');
const waiting = activities.filter((a) => a.status === 'waiting_for_user');
```

### Activity Object Structure

```typescript
interface Activity {
  id: string; // Unique tool call ID
  tool: string; // Tool name (e.g., "get_weather")
  args: object; // Arguments passed to tool
  status: string; // Current status
  result?: unknown; // Result after completion
  title?: string; // Display title
  description?: string; // Status message
  timestamp: Date; // When started
  agentName?: string; // Which agent called it
}
```

---

## HITL (Human-in-the-Loop)

HITL tools **pause the agent** and wait for user input before continuing.

### When to Use HITL

- ✅ Confirmations ("Submit this $5000 order?")
- ✅ User selections ("Choose one of these options")
- ✅ Form inputs ("Enter delivery address")
- ❌ NOT for read-only displays (use regular tool templates)

### How HITL Works

```
1. Agent calls HITL tool
      ↓
2. Activity created with status: 'waiting_for_user'
      ↓
3. Your HITL template renders with 'respond' callback
      ↓
4. User clicks button → respond('approved')
      ↓
5. Response sent to backend as tool result
      ↓
6. Agent continues execution
```

### Implementing HITL

**1. Define the tool (in your service):**

```typescript
provideTool(
  {
    definition: {
      name: 'ask_confirmation',
      description: 'Ask user to confirm an action',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'What to confirm' },
        },
        required: ['action'],
      },
    },
    hitl: true, // ← This marks it as HITL
  },
  { injector: this.injector },
);
```

**2. Create the template (in your component):**

```html
<ng-template
  agHitlRender="ask_confirmation"  <!-- Use agHitlRender, NOT agToolRender -->
  let-args="args"
  let-respond="respond"
  let-status="status"
>
  @if (status === 'waiting_for_user') {
    <div class="confirm-dialog">
      <h3>Confirmation Required</h3>
      <p>{{ args.action }}</p>
      <button (click)="respond('yes')">Confirm</button>
      <button (click)="respond('no')">Cancel</button>
    </div>
  } @else if (status === 'completed') {
    <div class="completed">✓ Response submitted</div>
  }
</ng-template>
```

**3. Wire up the outlet:**

```html
<ag-tool-render-outlet
  [activities]="agentService.activities"
  [onRespond]="handleRespond.bind(this)"
/>
```

```typescript
handleRespond(toolCallId: string, result: unknown) {
  this.agentService.respondToHitl(toolCallId, result);
}
```

### HITL Response Format

> ⚠️ **Important:** HITL responses must be JSON objects, not raw strings!

```typescript
// ✅ Correct
respond({ response: 'approved' });
respond({ selection: 'option_a', notes: 'Please rush' });

// ❌ Wrong - will cause backend errors
respond('approved'); // Raw string - bad!
```

The library automatically wraps strings in `{ response: value }` for you.

---

## Tool Definitions vs Templates

These are **two separate concepts** that connect via the tool name.

### Tool Definition (For the Agent)

Tells the agent what tools exist and how to call them:

```typescript
// Sent to backend - agent sees this
const toolDefinition = {
  name: 'show_weather',
  description: 'Display weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string' },
    },
  },
};
```

### Tool Template (For the UI)

Tells Angular how to render the tool call:

```html
<!-- Rendered in browser - user sees this -->
<ng-template agToolRender="show_weather" let-args="args" let-status="status">
  <weather-card [location]="args.location" [loading]="status === 'running'" />
</ng-template>
```

### Why Separate?

| Concern                      | Component                 |
| ---------------------------- | ------------------------- |
| What tools the agent can use | Tool Definition → Backend |
| How tools look in the UI     | Tool Template → Frontend  |

This separation allows:

- Backend tools to render with frontend templates
- Frontend-only tools for UI-only actions
- Different UIs for the same tool in different contexts

---

## Services & Adapters

### AgContextService (Singleton)

Global registry for all tools and context.

```typescript
// Inject anywhere
private contextService = inject(AgContextService);

// Access registered tools
const toolDefs = this.contextService.toolDefinitions();
const hitlTools = this.contextService.hitlActionNames();

// Access context items
const context = this.contextService.contextItems();
```

### AgAdkAdapter (Per-Endpoint)

Each adapter manages ONE backend endpoint.

```typescript
// Create in your service
private adapter = new AgAdkAdapter({
  url: '/api/my-agent',           // Backend URL
  contextService: this.contextService,
  debug: true,                    // Enable console logging
  agentNames: {                   // Friendly names for agents
    'coordinator': 'Project Manager',
    'analyst': 'Data Analyst'
  },
  toolTitles: {                   // Friendly titles for tools
    'get_weather': 'Checking Weather'
  }
});
```

### ToolRenderRegistry (Singleton)

Stores UI templates. Usually accessed via directives.

```typescript
// Direct access (advanced)
private registry = inject(ToolRenderRegistry);

// Check if template exists
registry.hasTemplate('my_tool');

// Get template
const template = registry.getTemplate('my_tool');
const hitlTemplate = registry.getHitlTemplate('ask_confirmation');
```

---

## Next Steps

- [Quick Start Guide](./quick-start.md) - Build your first agent chat
- [HITL Tools Guide](./hitl-tools.md) - Deep dive into human-in-the-loop
- [Recipes](../recipes/) - Common patterns and examples
- [Troubleshooting](../troubleshooting/) - Common mistakes and solutions
