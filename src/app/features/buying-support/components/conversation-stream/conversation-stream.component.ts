import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Message, ActivityMessage } from '@ag-ui/core';
import { AppState, ChatStreamItem, ProductCard, SupplierItem, ThinkingStep, ThoughtsPanel, ToolCallState, ProductOptionsPanel, SupplierListPanel, SearchProgressPanel } from '../../models/app-state.model';

import { MarkdownComponent } from 'ngx-markdown';

import { toObservable } from '@angular/core/rxjs-interop';
import { StateService } from 'src/app/features/buying-support/agent-state/state.service';
import { AgentService } from 'src/app/features/buying-support/agent-state/agent.service';
import { ProductCarouselComponent } from '../product-carousel/product-carousel.component';

import { SupplierCarouselComponent } from '../supplier-carousel/supplier-carousel.component';
import { ConfirmationToolComponent } from '../confirmation-tool/confirmation-tool.component';
import { SearchProgressComponent } from '../search-progress/search-progress.component';
import { LucideAngularModule, Bot, ShoppingCart, FileText, BookOpen, Check, Loader2, AlertCircle, Link } from 'lucide-angular';

export interface AgentGroup {
  type: 'agent-group';
  items: (Message | ToolCallState | ThoughtsPanel | SearchProgressPanel)[];
  agentName?: string;
}

export interface UserGroup {
  type: 'user-group';
  items: Message[];
}

export interface StandaloneGroup {
  type: 'standalone-group';
  item: ChatStreamItem;
}

export interface ThinkingGroup {
  type: 'thinking-group';
  item: ThoughtsPanel;
}

export type StreamGroup = AgentGroup | UserGroup | StandaloneGroup | ThinkingGroup;

@Component({
  selector: 'app-conversation-stream',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    MarkdownComponent,
    MarkdownComponent,
    ProductCarouselComponent,
    SupplierCarouselComponent,
    ConfirmationToolComponent,
    SearchProgressComponent,
    LucideAngularModule
  ],
  templateUrl: './conversation-stream.component.html',
  styleUrl: './conversation-stream.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationStreamComponent {
  readonly icons = { Bot, ShoppingCart, FileText, BookOpen, Check, Loader2 };
  @ViewChild('chatMessagesContainer') private chatMessagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') private messageInput!: ElementRef<HTMLInputElement>;
  stateService = inject(StateService);
  agentService = inject(AgentService);
  messages = input<Message[]>([]);
  activities = input<ActivityMessage[]>([]);
  isLoading = input<boolean>(false);
  thinkingSteps = input<ThinkingStep[]>([]);


  sendMessage = output<string>();
  addToPr = output<ProductCard>();
  selectSupplier = output<SupplierItem>();

  private userMessage = signal<string>('');
  state = computed(() => this.stateService.state());

  state$ = toObservable(this.stateService.state);

  private isUserAtBottom = signal<boolean>(true);
  private scrollThreshold = 150; // pixels from bottom to consider "at bottom"
  isShowScrollButton = computed(() => !this.isUserAtBottom());

  // Grouped Stream Logic
  groupedStream = computed(() => {
    const stream = this.state().chatStream;
    const groups: StreamGroup[] = [];
    let currentAgentGroup: AgentGroup | null = null;

    for (const item of stream) {
      // 1. User Messages -> Close Agent Group, add User Group
      if (this.isMessage(item) && item.role === 'user') {
        currentAgentGroup = null;
        groups.push({ type: 'user-group', items: [item] });
        continue;
      }

      // 2. Thinking Panel -> Check if it should be visible
      if (this.isThoughtsPanel(item)) {
        if (this.shouldShowThinking(item)) {
          // Visible thinking -> Close Agent Group, add Thinking Group
          currentAgentGroup = null;
          groups.push({ type: 'thinking-group', item });
          continue;
        } else {
          // Hidden thinking -> Treat as part of Agent Group (don't break the bubble)
          // We add it to the group so it's part of the stream, but the template won't render it
          // inside the bubble because we removed the rendering logic for thoughts in the bubble.
          // Actually, if we add it to the items, we need to make sure the template ignores it.
          // The template iterates over items. We removed the @if (isThoughtsPanel) block from the agent group template.
          // So adding it here is safe; it just won't render, but it keeps the group alive.
        }
      }

      // 3. Agent Messages / Tool Calls / Hidden Thoughts / Search Progress -> Add to Agent Group
      if (
        (this.isMessage(item) && item.role === 'assistant') ||
        this.isToolCall(item) ||
        (this.isThoughtsPanel(item) && !this.shouldShowThinking(item)) ||
        this.isSearchProgressPanel(item)
      ) {
        let itemAgentName: string | undefined;
        if (this.isMessage(item)) {
          itemAgentName = item.name;
        } else if (this.isToolCall(item)) {
          itemAgentName = item.agentName;
        } else if (this.isThoughtsPanel(item)) {
             itemAgentName = item.steps[0]?.author;
        } else if (this.isSearchProgressPanel(item)) {
          // Search panel belongs to the agent performing the search (usually tavily_search_agent)
          // We can try to infer or just default to current group if compatible
          // For now, let's assume it belongs to the current agent context or 'tavily_search_agent'
          // But we don't have agentName on the panel itself easily.
          // Let's assume it inherits the current agent group or starts a new one if none.
          // If we want to be precise, we might need to add agentName to SearchProgressPanel.
          // For now, let's treat it as 'Assistant' or keep current group.
        }

        // Check if we need to start a new group due to name change
        if (currentAgentGroup) {
          if (itemAgentName && itemAgentName !== currentAgentGroup.agentName) {
            currentAgentGroup = null;
          }
        }

        if (!currentAgentGroup) {
          currentAgentGroup = {
            type: 'agent-group',
            items: [],
            agentName: itemAgentName || 'Assistant'
          };
          groups.push(currentAgentGroup);
        } else {
          if (currentAgentGroup.agentName === 'Assistant' && itemAgentName) {
            currentAgentGroup.agentName = itemAgentName;
          }
        }

        currentAgentGroup.items.push(item);
        continue;
      }

      // 4. Standalone Panels (Product/Supplier) -> Close Agent Group, add as standalone
      currentAgentGroup = null;
      groups.push({ type: 'standalone-group', item });
    }

    return groups;
  });

  constructor() {
    // Track the previous stream length to detect new items
    let previousStreamLength = 0;

    // Effect to handle auto-scrolling when new messages arrive
    effect(() => {
      // Track changes to the chat stream
      const stream = this.state().chatStream;
      const currentLength = stream.length;
      const hasNewItems = currentLength > previousStreamLength;

      // Check if user is at the bottom BEFORE we update
      // We need to do this synchronously before DOM updates
      const shouldScroll = this.isUserAtBottom() || hasNewItems;

      if (shouldScroll && this.chatMessagesContainer) {
        // Use requestAnimationFrame to scroll after DOM updates
        requestAnimationFrame(() => {
          this.scrollToBottom();
        });
      }

      previousStreamLength = currentLength;
    });

    // Also set up an afterNextRender to scroll on initial load
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }


  // Type guard functions for the template
  isMessage(item: ChatStreamItem): item is Message {
    return 'role' in item;
  }

  isToolCall(item: ChatStreamItem): item is ToolCallState {


    return 'type' in item && item.type === 'tool-call';
  }

  isThoughtsPanel(item: ChatStreamItem): item is ThoughtsPanel {
    return 'type' in item && item.type === 'thoughts-panel';
  }

  isProductOptionsPanel(item: ChatStreamItem): item is ProductOptionsPanel {
    return 'type' in item && item.type === 'product-options-panel';
  }

  isSupplierListPanel(item: ChatStreamItem): item is SupplierListPanel {
    return 'type' in item && item.type === 'supplier-list-panel';
  }

  isSearchProgressPanel(item: ChatStreamItem): item is SearchProgressPanel {
    return 'type' in item && item.type === 'search-progress-panel';
  }

  handleSendMessage(message: string = this.userMessage()): void {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !this.isLoading()) {
      this.sendMessage.emit(trimmedMessage);
      this.userMessage.set('');
      // Keep focus on input after sending
      setTimeout(() => this.focusInput(), 100);
      // Ensure scroll to bottom after sending message
      this.scrollToBottomForced();
      // Clear suggestions when user sends a message manually
      this.stateService.clearSuggestions();
    }
  }


  toggleThinkingStep(stepId: string): void {
    this.stateService.toggleThinkingStep(stepId);
  }
  toggleToolCall(toolCallId: string): void {
    this.stateService.toggleToolCallExpansion(toolCallId); // Assumes you add this method to StateService
  }
  protected getMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
        .map((item) => item.text)
        .join('\n');
    }
    return '';
  }
  /**
   * Handles scroll event to track if user is at bottom
   */
  onScroll(event: Event): void {
    const element = event.target as HTMLDivElement;

    // Calculate if user is near the bottom
    const distanceFromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);

    // User is at bottom if within threshold (150px)
    this.isUserAtBottom.set(distanceFromBottom < this.scrollThreshold);
  }

  /**
   * Scroll to bottom of chat
   */
  private scrollToBottom(): void {
    if (this.chatMessagesContainer?.nativeElement) {
      const element = this.chatMessagesContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'instant' // Use 'instant' during streaming for smoother experience
      });
    }
  }
  // Add method
  scrollToBottomClick(): void {
    this.scrollToBottomForced();
  }

  /**
   * Force scroll to bottom (for urgent messages or user action)
   */
  scrollToBottomForced(): void {
    this.isUserAtBottom.set(true);
    if (this.chatMessagesContainer?.nativeElement) {
      const element = this.chatMessagesContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
  focusInput(): void {
    if (this.messageInput) {
      this.messageInput.nativeElement.focus();
    }
  }


  shouldShowThinking(item: ChatStreamItem): boolean {
    const stream = this.state().chatStream;
    if (stream.length === 0) return false;

    const lastItem = stream[stream.length - 1];
    const isLastItem = item === lastItem;
    const isRunning = this.state().runStatus === 'running';

    // Only show thinking if it's the last item and the agent is currently running
    return isLastItem && isRunning;
  }

  showGenericLoading = computed(() => {
    if (!this.isLoading()) return false;
    
    const stream = this.state().chatStream;
    if (stream.length === 0) return true;
    
    const lastItem = stream[stream.length - 1];
    // If the last item is a thoughts panel, we are already showing the specific thinking UI
    // via the thinking-group in the loop
    return !this.isThoughtsPanel(lastItem);
  });

  getToolRequest(item: ToolCallState): string | null {
    // Priority 1: Display Text from Activity Snapshot
    if (item.displayText) {
      return item.displayText;
    }

    // Priority 2: Request arg from Tool Args
    if (!item.args) return null;
    try {
      // Try parsing as complete JSON first
      const args = JSON.parse(item.args);
      return args.request || null;
    } catch (e) {
      // If JSON is incomplete (streaming), try to extract 'request' using regex
      // Matches "request": "value" handling escaped quotes
      const match = item.args.match(/"request"\s*:\s*"((?:[^"\\]|\\.)*)"/);

      return match ? match[1] : null;
    }
  }

  hasVisibleItems(group: AgentGroup): boolean {
    return group.items.some(item => {
      // 1. Assistant Messages are visible
      if (this.isMessage(item) && item.role === 'assistant') {
        return true;
      }

      // 2. Tool Calls are visible if they have a request or are specific tools
      if (this.isToolCall(item)) {
        if (item.toolName === 'ask_user_confirmation') {
          return true;
        }
        // Check if it has a visible request string
        if (this.getToolRequest(item)) {
          return true;
        }
      }

      // 3. Search Progress Panel is visible
      if (this.isSearchProgressPanel(item)) {
        return true;
      }

      // Thoughts are handled in ThinkingGroup, so they are not "visible" in AgentGroup
      return false;
    });
  }

  copiedMessageId = signal<string | null>(null);

  copyToClipboard(content: any, messageId: string) {
    if (!content) return;

    let textToCopy = '';

    if (typeof content === 'string') {
      textToCopy = content;
    } else if (Array.isArray(content)) {
      // Handle array of content parts (e.g. [{type: 'text', text: '...'}]
      textToCopy = content
        .map(part => {
          if (part.type === 'text') return part.text;
          return '';
        })
        .join('');
    } else if (typeof content === 'object') {
      // Fallback for other objects
      textToCopy = JSON.stringify(content);
    }

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      this.copiedMessageId.set(messageId);
      setTimeout(() => {
        this.copiedMessageId.set(null);
      }, 2000);
    });
  }

  getAgentGroupContent(group: AgentGroup): string {
    return group.items
      .filter(item => this.isMessage(item) && item.role === 'assistant')
      .map(item => (item as Message).content)
      .join('\n\n');
  }

  extractUrls(content: any): string[] {
    const text = this.getMessageText(content);
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  isOnlyUrls(content: any): boolean {
    const text = this.getMessageText(content);
    if (!text) return false;
    const urls = this.extractUrls(content);
    if (urls.length === 0) return false;
    
    // Remove all URLs and whitespace from text
    let remainingText = text;
    urls.forEach(url => {
      remainingText = remainingText.replace(url, '');
    });
    return remainingText.trim().length === 0;
  }

  getLinkMetadata(content: any): { domain: string; title: string; favicon: string } {
    const urlStr = this.getMessageText(content);
    try {
      const url = new URL(urlStr);
      const domain = url.hostname.replace('www.', '');
      
      // Try to derive a title from the path
      let title = url.pathname.split('/').filter(p => p).pop() || domain;
      title = title.replace(/-/g, ' ').replace(/_/g, ' ');
      // Capitalize first letter
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      if (title === domain) {
          title = "Visit Website";
      }

      return {
        domain,
        title,
        favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
      };
    } catch {
      return { domain: '', title: 'Link', favicon: '' };
    }
  }
}
