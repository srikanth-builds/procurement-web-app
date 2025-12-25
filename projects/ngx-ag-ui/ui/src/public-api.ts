/**
 * ngx-ag-ui/ui
 * 
 * UI components and directives for building agentic Angular applications.
 * Provides custom rendering capabilities for agent tool calls and actions.
 */

// Services
export * from './lib/services/tool-render-registry';

// Components
export * from './lib/components/tool-render-outlet.component';

// Directives
export * from './lib/directives/tool-render.directive';
export * from './lib/directives/readable.directive';
export * from './lib/directives/action-render.directive';
export * from './lib/directives/hitl-render.directive';

// Re-export commonly used types from core
export type { ToolCall } from '../../core/src/lib/types/events';
export type { ActionRenderProps } from '../../core/src/lib/types/actions';

