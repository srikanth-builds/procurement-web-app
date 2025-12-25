/**
 * ngx-ag-ui/core
 * 
 * Core library for building agentic Angular applications.
 * Provides services, types, and utilities for AG-UI protocol communication.
 */

// Types
export * from './lib/types/events';
export * from './lib/types/agent-tool';
export * from './lib/types/actions';
export * from './lib/types/state';
export * from './lib/types/index';

// Services
export * from './lib/services/ag-context.service';
export * from './lib/services/ag-agent.service';

// Adapters
export * from './lib/adapters/ag-adk-adapter';

// Functions
export * from './lib/functions/provide-action';
export * from './lib/functions/provide-readable';
