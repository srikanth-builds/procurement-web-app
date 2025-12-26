# API Reference

Complete API documentation for ngx-ag-ui.

---

## Core Package (`ngx-ag-ui/core`)

### AgAdkAdapter

Main adapter for managing agent communication.

```typescript
import { AgAdkAdapter } from 'ngx-ag-ui/core';

const adapter = new AgAdkAdapter(options);
```

#### Constructor Options

| Option           | Type                               | Required | Description                                        |
| ---------------- | ---------------------------------- | -------- | -------------------------------------------------- |
| `url`            | `string`                           | ✅       | Backend agent endpoint URL                         |
| `contextService` | `AgContextService`                 | ❌       | Reference to context service                       |
| `debug`          | `boolean`                          | ❌       | Enable console logging                             |
| `threadId`       | `string`                           | ❌       | Initial thread ID (auto-generated if not provided) |
| `initialState`   | `object`                           | ❌       | Initial custom state                               |
| `agentNames`     | `Record<string, string>`           | ❌       | Map agent IDs to display names                     |
| `toolTitles`     | `Record<string, string>`           | ❌       | Map tool names to display titles                   |
| `onToolCallEnd`  | `(id, name, args) => Promise<any>` | ❌       | Handler for tool call completion                   |
| `onEvent`        | `(event: AgEvent) => void`         | ❌       | Callback for ALL events (logging, animations)      |
| `onCustomEvent`  | `Record<string, (data) => void>`   | ❌       | Typed handlers for custom events by name           |

#### Signals (Readonly)

| Signal             | Type                              | Description                    |
| ------------------ | --------------------------------- | ------------------------------ |
| `messages`         | `Signal<Message[]>`               | All conversation messages      |
| `activities`       | `Signal<Activity[]>`              | Tool call activities           |
| `isLoading`        | `Signal<boolean>`                 | True when agent is processing  |
| `error`            | `Signal<string \| null>`          | Current error message          |
| `customState`      | `Signal<Record<string, unknown>>` | State from backend             |
| `customEvents`     | `Signal<StoredCustomEvent[]>`     | Custom events from backend     |
| `threadId`         | `Signal<string>`                  | Current conversation thread ID |
| `runId`            | `Signal<string \| null>`          | Current run ID                 |
| `currentAgentName` | `Signal<string>`                  | Active agent's display name    |

#### Methods

```typescript
// Send user message
await adapter.sendMessage(content: string, context?: RunContext): Promise<void>

// Send HITL response
await adapter.sendHitlResponse(toolCallId: string, result: unknown): Promise<void>

// Reset conversation
adapter.reset(threadId?: string): void

// Restore from history
await adapter.restoreHistory(history: HistoryEntry[], threadId?: string): Promise<void>

// Cleanup
adapter.destroy(): void
```

---

### AgContextService

Global registry for tools and context.

```typescript
import { AgContextService } from 'ngx-ag-ui/core';

private contextService = inject(AgContextService);
```

#### Signals

| Signal            | Type                         | Description             |
| ----------------- | ---------------------------- | ----------------------- |
| `actions`         | `Signal<RegisteredAction[]>` | All registered actions  |
| `toolDefinitions` | `Signal<ToolDefinition[]>`   | Actions as tool schemas |
| `hitlActionNames` | `Signal<Set<string>>`        | Names of HITL tools     |
| `contextItems`    | `Signal<ContextItem[]>`      | Registered context data |
| `suggestions`     | `Signal<Suggestion[]>`       | Chat suggestions        |

#### Methods

```typescript
// Register an action
registerAction(action: AgAction): string  // Returns registration ID

// Unregister an action
unregisterAction(id: string): void

// Get action by name
getActionByName(name: string): RegisteredAction | undefined

// Execute action handler
executeAction(name: string, args: object): Promise<unknown>

// Add context
addContext(item: ContextItem): string  // Returns context ID

// Remove context
removeContext(id: string): void

// Set suggestions
setSuggestions(suggestions: string[]): void

// Reset all state
reset(): void
```

---

### provideTool

Register a frontend tool.

```typescript
import { provideTool } from 'ngx-ag-ui/core';

const registrationId = provideTool(
  {
    definition: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
      };
    };
    handler?: (args: any) => any | Promise<any>;
    hitl?: boolean;
    title?: string;
  },
  { injector?: Injector }  // Required if outside injection context
);
```

---

### provideReadable

Register context data for the agent.

```typescript
import { provideReadable } from 'ngx-ag-ui/core';

provideReadable({
  description: 'Current user preferences',
  value: () => this.userService.preferences(),
});
```

---

## UI Package (`ngx-ag-ui/ui`)

### ToolRenderDirective

Register a template for tool rendering.

```html
<ng-template
  agToolRender="tool_name"
  [agToolRenderPriority]="0"
  let-args="args"
  let-status="status"
  let-result="result"
  let-toolCallId="toolCallId"
  let-toolName="toolName"
  let-title="title"
>
  <!-- Your template -->
</ng-template>
```

#### Template Context

| Variable     | Type                | Description           |
| ------------ | ------------------- | --------------------- |
| `$implicit`  | `ToolRenderContext` | Full context object   |
| `args`       | `object`            | Tool arguments        |
| `status`     | `string`            | Activity status       |
| `result`     | `unknown`           | Tool result           |
| `toolCallId` | `string`            | Unique tool call ID   |
| `toolName`   | `string`            | Tool name             |
| `title`      | `string`            | Display title         |
| `respond`    | `(result) => void`  | HITL respond function |

---

### HitlRenderDirective

Register a template for HITL tool rendering.

```html
<ng-template
  agHitlRender="hitl_tool_name"
  [agHitlRenderPriority]="0"
  let-args="args"
  let-respond="respond"
  let-status="status"
>
  @if (status === 'waiting_for_user') {
  <button (click)="respond('approved')">Approve</button>
  }
</ng-template>
```

---

### ToolRenderOutletComponent

Renders matching templates for activities.

```html
<ag-tool-render-outlet
  [activities]="adapter.activities"
  [filter]="'with-template'"
  [onlyTools]="['tool1', 'tool2']"
  [excludeTools]="['tool3']"
  [onRespond]="handleRespond.bind(this)"
  [debug]="false"
/>
```

#### Inputs

| Input          | Type                                                   | Default           | Description              |
| -------------- | ------------------------------------------------------ | ----------------- | ------------------------ |
| `activities`   | `Activity[] \| Signal<Activity[]>`                     | Required          | Activities to render     |
| `filter`       | `'all' \| 'running' \| 'completed' \| 'with-template'` | `'with-template'` | Which activities to show |
| `onlyTools`    | `string[]`                                             | `[]`              | Only render these tools  |
| `excludeTools` | `string[]`                                             | `[]`              | Exclude these tools      |
| `onRespond`    | `(id: string, result: unknown) => void`                | -                 | HITL response callback   |
| `debug`        | `boolean`                                              | `false`           | Enable debug logging     |

---

## Types

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCallId?: string; // For tool role messages
  toolCalls?: ToolCall[]; // For assistant messages with tool calls
}
```

### Activity

```typescript
interface Activity {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_user';
  result?: unknown;
  title?: string;
  description?: string;
  timestamp: Date;
  agentName?: string;
}
```

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

### RunContext

```typescript
interface RunContext {
  tools?: ToolDefinition[];
  context?: ContextItem[];
  forwardedProps?: Record<string, unknown>;
}
```
