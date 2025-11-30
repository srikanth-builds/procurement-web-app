import { ActivityMessage, Message, BaseEvent } from '@ag-ui/core';
import { WritableSignal } from '@angular/core';

// Represents a single step in the agent's thinking process
export interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  isExpanded: boolean;
  author: string; // The name of the agent that produced this step
}
// // Extended Message interface to include the author (agent name)
// export interface Message {
//   id: string;
//   role: 'user' | 'assistant' | 'system' | 'tool' | 'activity';
//   content: string;
//   author?: string; // Optional: The name of the agent generating the message
// }
export type ToolCallStateStatus = 'running' | 'success' | 'error';
export interface ToolCallState {
  type: 'tool-call'; // Discriminating property for the template
  toolCallId: string;
  toolName: string;
  args: string;
  status: ToolCallStateStatus;
  result?: any;
  isExpanded: boolean;
  updatedAt: Date;
  agentName?: string;
  displayText?: string;
}
// Represents the collapsible panel for thoughts
// Represents the collapsible panel for thoughts
export interface ThoughtsPanel {
  type: 'thoughts-panel';
  id: string; // Allow dynamic IDs
  steps: ThinkingStep[];
}
export interface ProductOptionsPanel {
  type: 'product-options-panel';
  id: string;
  products: ProductOption[];
}

export interface SupplierListPanel {
  type: 'supplier-list-panel';
  id: string;
  suppliers: SupplierItem[];
}

export type ChatStreamItem = Message | ToolCallState | ThoughtsPanel | ProductOptionsPanel | SupplierListPanel;

export interface UserProfile {
  name: string;
  contact: string;
  department?: string;
}

export interface ProductOption {
  name: string;
  description: string;
  vendor: string;
  price: number;
  image_url?: string;
  source_url?: string;
  specs?: { [key: string]: string }; // Changed to map for keyvalue pipe
  specifications?: { key: string; value: string }[]; // Keep for backward compatibility if needed
  sku?: string; // Optional, can be derived or missing
  quantity?: number;
}

// Keep ProductCard for backward compatibility if needed, or alias it
export type ProductCard = ProductOption;

export interface SupplierHistoryItem {
  date: string;
  orderId: string;
  items: string[];
  totalValue: number;
  performanceRating: number;
  feedback?: string;
}

export interface SupplierItem {
  id: string;
  name: string;
  contact: string;
  rating: number;
  location: string;
  status: 'Preferred' | 'Approved' | 'Probation' | 'New';
  website?: string;
  history?: SupplierHistoryItem[];
  selected?: boolean;
}

export interface PurchaseRequisition {
  prId: string;
  requester: UserProfile;
  expectedDelivery: string;
  justification: string;
  suppliers: SupplierItem[];
  items: ProductCard[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface Artifact {
  filename: string;
  version: number;
  adk_artifact_uri: string;
  gcs_download_url: string;
  proxy_download_url: string;
}

export interface AppState {
  runStatus: 'idle' | 'running';
  currentAgentName: string;
  messages: Message[]; // Still used for updating message content by ID
  toolCalls: ToolCallState[]; // NEW: Tracks all tool calls for easy updating
  chatStream: ChatStreamItem[]; // NEW: The single, chronological stream for the UI
  activities: ActivityMessage[];
  thinkingSteps: ThinkingStep[];
  suggestions: string[];
  purchaseRequisition: PurchaseRequisition;
  artifacts: Artifact[];
  error: string | null;
}

// import { ActivityMessage, Message } from '@ag-ui/core';

// // --- MIRRORS of Backend Pydantic Models ---
// export interface ProductCard {
//   name: string;
//   sku: string;
//   price: number;
//   // imageUrl: string;
//   description: string;
// }

// export interface SupplierItem {
// [x: string]: any;
//   id: string;
//   name: string;
//   rating: string;
//   leadTime: string;
// }

// // --- UI STATE DEFINITION ---
// export interface PurchaseRequisition {
//   prId: string | null;
//   requester: { name: string; contact: string } | null;
//   expectedDelivery: string | null;
//   justification: string;
//   suppliers: SupplierItem[];
//   items: ProductCard[];
//   subtotal: number;
//   tax: number;
//   total: number;
// }

// export interface AppState {
//   runStatus: 'idle' | 'running' | 'awaiting_input';
//   messages: Message[];
//   activities: ActivityMessage[];
//   purchaseRequisition: PurchaseRequisition;
//   error: string | null;
// }
