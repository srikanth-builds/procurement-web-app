# Custom Events Guide

Handle custom events from your backend to build reactive, dynamic UIs.

---

## Overview

The backend can emit custom events beyond the standard AG-UI protocol. ngx-ag-ui provides two ways to handle them:

1. **Callback-based** - `onEvent` and `onCustomEvent` for imperative handling
2. **Signal-based** - `customEvents` signal for reactive access

---

## Callback-based Handling

### Listen to ALL Events

Use `onEvent` to receive every event from the backend:

```typescript
private adapter = new AgAdkAdapter({
  url: '/api/agent',

  onEvent: (event) => {
    // Triggered for every event
    console.log('Event:', event.type, event);

    // Example: Shake animation on errors
    if (event.type === 'RUN_ERROR') {
      this.animationService.shake();
    }

    // Example: Track all events for analytics
    this.analytics.trackEvent(event.type, event);
  }
});
```

### Handle Specific Custom Events

Use `onCustomEvent` for typed handling of named custom events:

```typescript
private adapter = new AgAdkAdapter({
  url: '/api/agent',

  onCustomEvent: {
    // Handler for 'workflow_update' custom events
    'workflow_update': (data) => {
      this.workflowState.set(data as WorkflowState);
    },

    // Handler for 'notification' custom events
    'notification': (data: any) => {
      this.toastService.show(data.message, data.type);
    },

    // Handler for 'progress' custom events
    'progress': (data: any) => {
      this.progressBar.update(data.percent);
    }
  }
});
```

---

## Signal-based Handling

### Access All Custom Events

The `customEvents` signal stores all custom events reactively:

```typescript
// In your service
readonly customEvents = this.adapter.customEvents;

// In your component
constructor() {
  // Effect that runs when new custom events arrive
  effect(() => {
    const events = this.agentService.customEvents();
    const latest = events[events.length - 1];
    if (latest) {
      console.log('Latest custom event:', latest);
    }
  });
}
```

### Filter by Event Type

Use computed signals to filter for specific event types:

```typescript
// Reactive filter for workflow events
readonly workflowEvents = computed(() =>
  this.adapter.customEvents()
    .filter(e => e.name === 'workflow_update')
);

// Reactive filter for recent notifications (last 5)
readonly recentNotifications = computed(() =>
  this.adapter.customEvents()
    .filter(e => e.name === 'notification')
    .slice(-5)
);
```

### In Templates

```html
<!-- Display workflow updates -->
@for (event of workflowEvents(); track event.id) {
<workflow-card [data]="event.data" [timestamp]="event.timestamp" />
}

<!-- Show notifications -->
@for (notif of recentNotifications(); track notif.id) {
<notification-toast [message]="notif.data.message" />
}
```

---

## CustomEvent Interface

```typescript
interface CustomEvent {
  id: string; // Unique event ID
  name: string; // Event type name (from backend)
  data: unknown; // Event payload
  timestamp: Date; // When received
}
```

---

## Backend: Emitting Custom Events

### Python (Google ADK)

```python
from ag_ui_protocol.types import CustomEvent

# Emit a custom event
await emit(CustomEvent(
    name="workflow_update",
    data={
        "step": "processing",
        "progress": 50,
        "message": "Analyzing data..."
    }
))
```

---

## Use Cases

| Use Case           | Event Name        | Data                               |
| ------------------ | ----------------- | ---------------------------------- |
| Progress updates   | `progress`        | `{ percent: 75, message: "..." }`  |
| Notifications      | `notification`    | `{ message: "...", type: "info" }` |
| Workflow state     | `workflow_update` | `{ step: "...", status: "..." }`   |
| Animation triggers | `animation`       | `{ type: "confetti" }`             |
| Debug info         | `debug`           | Any debug data                     |

---

## Tips

1. **Use `onEvent` for debugging** - Log all events during development
2. **Use `onCustomEvent` for typed handlers** - Cleaner than switch statements
3. **Use signals for UI updates** - Reactive and efficient
4. **Limit stored events** - Clear old events if list grows too large:

```typescript
// Clear events older than 5 minutes
clearOldEvents() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  this.adapter.customEvents.update(events =>
    events.filter(e => e.timestamp.getTime() > cutoff)
  );
}
```
