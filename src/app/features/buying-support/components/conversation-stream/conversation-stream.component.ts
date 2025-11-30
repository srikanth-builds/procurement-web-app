import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Message, ActivityMessage } from '@ag-ui/core';
import { AppState, ChatStreamItem, ProductCard, SupplierItem, ThinkingStep, ThoughtsPanel, ToolCallState, ProductOptionsPanel, SupplierListPanel } from '../../models/app-state.model';

import { MarkdownComponent } from 'ngx-markdown';

import { toObservable } from '@angular/core/rxjs-interop';
import { StateService } from 'src/app/features/buying-support/agent-state/state.service';
import { AgentService } from 'src/app/features/buying-support/agent-state/agent.service';
import { ProductCarouselComponent } from '../product-carousel/product-carousel.component';

import { SupplierCarouselComponent } from '../supplier-carousel/supplier-carousel.component';
import { LucideAngularModule, Bot, ShoppingCart, FileText, BookOpen, Check, Loader2 } from 'lucide-angular';

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
    LucideAngularModule
  ],
  templateUrl: './conversation-stream.component.html',
  styleUrl: './conversation-stream.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationStreamComponent {
  readonly icons = { Bot, ShoppingCart, FileText, BookOpen, Check, Loader2 };
  @ViewChild('chatMessagesContainer') chatMessagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLInputElement>;
  stateService = inject(StateService);
  agentService = inject(AgentService);
  messages = input.required<Message[]>();
  activities = input.required<ActivityMessage[]>();
  isLoading = input.required<boolean>();
  thinkingSteps = input<ThinkingStep[]>();


  sendMessage = output<string>();
  addToPr = output<ProductCard>();
  selectSupplier = output<SupplierItem>();

  userMessage = signal<string>('');
  state = computed(() => this.stateService.state());

  state$ = toObservable(this.stateService.state);

  private isUserAtBottom = signal<boolean>(true);
  private scrollThreshold = 150; // pixels from bottom to consider "at bottom"
  isShowScrollButton = computed(() => !this.isUserAtBottom());

  constructor() {

    // Effect to handle auto-scrolling when new messages arrive
    effect(() => {
      // Track changes to the chat stream
      const stream = this.state().chatStream;

      // If the user is currently at the bottom, scroll to the bottom after the view updates
      if (this.isUserAtBottom()) {
        setTimeout(() => {
          this.scrollToBottom();
        }, 100); // Small delay to allow DOM to render
      }
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
    if (this.chatMessagesContainer) {
      // Use setTimeout to ensure DOM has fully rendered
      setTimeout(() => {
        this.chatMessagesContainer.nativeElement.scrollTop =
          this.chatMessagesContainer.nativeElement.scrollHeight;
      }, 0);
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
    this.scrollToBottom();
  }
  focusInput(): void {
    if (this.messageInput) {
      this.messageInput.nativeElement.focus();
    }
  }


  shouldShowThinking(item: ChatStreamItem, index: number): boolean {
    const stream = this.state().chatStream;
    const isLastItem = index === stream.length - 1;
    const isRunning = this.state().runStatus === 'running';

    // Only show thinking if it's the last item and the agent is currently running
    return isLastItem && isRunning;
  }

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
}
