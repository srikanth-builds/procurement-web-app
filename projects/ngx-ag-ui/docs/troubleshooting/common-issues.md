# Troubleshooting Guide

Common issues and how to fix them.

---

## Quick Reference

| Symptom                     | Solution                                                     |
| --------------------------- | ------------------------------------------------------------ |
| "Tool not available"        | [Add to backend FrontendToolSet](#tool-not-available)        |
| HITL template not showing   | [Use agHitlRender directive](#hitl-template-not-rendering)   |
| Wrong template renders      | [Check for name conflicts](#wrong-template-renders)          |
| HITL response error         | [Use JSON object format](#hitl-response-errors)              |
| Template from wrong feature | [Add scope or namespace](#template-leaking-between-features) |

---

## Tool Not Available

### Symptom

Agent says: "I cannot use the tool X because it's not available"

### Cause

The backend's `FrontendToolSet` doesn't include this tool.

### Solution

**1. Check frontend registration:**

```typescript
// In your service
provideTool({
  definition: {
    name: 'my_tool',  // ← This exact name
    description: '...',
    parameters: { ... }
  }
}, { injector: this.injector });
```

**2. Add to backend FrontendToolSet:**

```python
# In your Python agent
FrontendToolSet({
    "my_tool": {}  # ← Must match exactly
})
```

**3. Verify tools are sent:**

```typescript
// Add temporary debug logging
console.log('Tools being sent:', this.contextService.toolDefinitions());
```

---

## HITL Template Not Rendering

### Symptom

Tool activity exists but no UI appears, or wrong UI appears.

### Cause

Using `agToolRender` instead of `agHitlRender`, or tool not marked as HITL.

### Solution

**1. Use correct directive:**

```html
<!-- ❌ Wrong -->
<ng-template agToolRender="ask_confirmation">
  <!-- ✅ Correct for HITL -->
  <ng-template agHitlRender="ask_confirmation"></ng-template
></ng-template>
```

**2. Ensure tool is marked HITL:**

```typescript
provideTool({
  definition: { ... },
  hitl: true  // ← Must be true for HITL tools
}, { injector });
```

**3. Check activity status:**

```typescript
// HITL tools should have status: 'waiting_for_user'
console.log(this.activities().map((a) => ({ tool: a.tool, status: a.status })));
```

**4. Import the directive:**

```typescript
import { HitlRenderDirective } from 'ngx-ag-ui/ui';

@Component({
  imports: [HitlRenderDirective]  // ← Must import
})
```

---

## Wrong Template Renders

### Symptom

A template from a different feature renders for your tool.

### Cause

Multiple templates registered for the same tool name in the global registry.

### Solution

**Option 1: Use different tool names**

```typescript
// Feature A
{
  name: 'buying_confirm';
}

// Feature B
{
  name: 'planner_confirm';
}
```

**Option 2: Filter by tool in outlet**

```html
<ag-tool-render-outlet
  [activities]="activities"
  [onlyTools]="['my_feature_tool1', 'my_feature_tool2']"
/>
```

**Option 3: Use priority (higher wins)**

```html
<ng-template agToolRender="shared_tool" [agToolRenderPriority]="10"></ng-template>
```

---

## HITL Response Errors

### Symptom

Backend error about non-dict/invalid content when responding to HITL.

### Cause

Sending raw string instead of JSON object.

### Solution

The library now auto-wraps strings, but for clarity:

```typescript
// ✅ Correct - respond with object
respond({ response: 'approved', notes: 'Looks good' });

// ✅ Also correct - string auto-wraps to {response: 'Yes'}
respond('Yes');

// ❌ If manually calling sendHitlResponse:
await adapter.sendHitlResponse(toolCallId, { response: 'approved' });
```

---

## Template Leaking Between Features

### Symptom

Template registered in Feature A appears in Feature B's tool outlet.

### Cause

`ToolRenderRegistry` is a singleton shared across the app.

### Solution

**Current workarounds:**

1. **Namespace tool names:**

   ```typescript
   // Instead of generic names
   {
     name: 'confirm';
   }

   // Use feature-prefixed names
   {
     name: 'buying_confirm';
   }
   {
     name: 'planner_confirm';
   }
   ```

2. **Filter tools per outlet:**

   ```html
   <ag-tool-render-outlet [onlyTools]="['feature_a_*']" />
   ```

3. **Use separate components that mount/unmount:**
   Templates unregister when component destroys.

---

## Double Response Submission

### Symptom

HITL tool receives multiple responses, or errors about already responded.

### Cause

User clicks button multiple times, or respond called twice.

### Solution

The library tracks responded tools internally, but you can add extra protection:

```typescript
// Track in component
respondedTools = new Set<string>();

handleRespond(toolCallId: string, result: unknown) {
  if (this.respondedTools.has(toolCallId)) return;
  this.respondedTools.add(toolCallId);

  this.agentService.respondToHitl(toolCallId, result);
}
```

Or disable button after click:

```html
<button (click)="respond('yes')" [disabled]="submitted">Approve</button>
```

---

## Debug Mode

Enable debug logging to see all events:

```typescript
private adapter = new AgAdkAdapter({
  url: '/api/agent',
  debug: true  // ← Enable console logging
});
```

```html
<ag-tool-render-outlet
  [activities]="activities"
  [debug]="true"  <!-- Logs template lookups -->
/>
```

---

## Still Stuck?

1. Check browser console for errors
2. Check network tab for SSE events
3. Enable debug mode on adapter and outlet
4. Verify backend is running and responding

### Useful Debug Commands

```typescript
// Check registered tools
console.log('Tools:', inject(AgContextService).toolDefinitions());

// Check HITL tools
console.log('HITL:', inject(AgContextService).hitlActionNames());

// Check activities
console.log('Activities:', this.adapter.activities());

// Check templates
console.log('Templates:', inject(ToolRenderRegistry).registeredTools());
```
