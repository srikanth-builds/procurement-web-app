import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { EventType } from '@ag-ui/core';
import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmResizableImports } from '../../../../lib/ui/resizable/src';
import { TextFieldModule } from '@angular/cdk/text-field';
import { LucideAngularModule } from 'lucide-angular';
import { HlmTooltipImports } from '../../../../lib/ui/tooltip/src';
import { BrnTooltipContentTemplate } from '@spartan-ng/brain/tooltip';
import { AgentService } from '../../agent-state/agent.service';

import { ProductCard, SupplierItem } from '../../models/app-state.model';
import { ConversationStreamComponent } from '../../components/conversation-stream/conversation-stream.component';
import { PurchaseRequisitionFormComponent } from '../../components/purchase-requisition-form/purchase-requisition-form.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { HistoryComponent } from '../../components/history/history.component';
import { StateService } from '../../agent-state/state.service';
import { SuggestionsComponent } from '../../components/suggestions/suggestions.component';
import { ResourceExhaustedErrorComponent } from '../../components/resource-exhausted-error/resource-exhausted-error.component';
import { MemoryService } from '../../../../core/services/memory.service';



@Component({
    selector: 'buying-support-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, HlmResizableImports, ConversationStreamComponent, PurchaseRequisitionFormComponent, ChatHeaderComponent, HistoryComponent, TextFieldModule, LucideAngularModule, SuggestionsComponent, ResourceExhaustedErrorComponent, HlmTooltipImports, BrnTooltipContentTemplate],
    templateUrl: './chat.html',
    styleUrl: './chat.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat {
    private cdr = inject(ChangeDetectorRef);
    private stateService = inject(StateService);
    private agentService = inject(AgentService);
    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    // Expose state signals to the template
    messages = computed(() => this.stateService.state().messages);
    activities = computed(() => this.stateService.state().activities);
    thinkingSteps = computed(() => this.stateService.state().thinkingSteps);
    suggestions = computed(() => this.stateService.state().suggestions);
    isLoading = this.agentService.isRunning;
    error = this.agentService.error;
    isResourceExhausted = computed(() => this.stateService.state().isResourceExhausted);

    // Memory status
    private memoryService = inject(MemoryService);
    memoryStatus = computed(() => this.stateService.state().memoryStatus);
    isMemoryEnabled = computed(() => this.memoryService.memoryScope() !== 'disabled');

    // Expose state signals to the template
    state = computed(() => this.stateService.state())

    userInput = signal('');
    currentMode = signal<'ask' | 'agent'>('ask');
    
    // Elapsed time tracking
    elapsedSeconds = signal<number>(0);
    private timerInterval: ReturnType<typeof setInterval> | null = null;

    toggleMode() {
        this.currentMode.update(mode => {
            const newMode = mode === 'ask' ? 'agent' : 'ask';
            this.agentService.setMode(newMode);
            return newMode;
        });
    }

    constructor() {
        // Watch for state changes and trigger change detection
        effect(() => {
            const currentState = this.state();
            // Access the state to track it
            console.log('State updated:', currentState);
            // Trigger change detection
            this.cdr.markForCheck();
        });

        // Effect to scroll to bottom when messages change
        effect(() => {
            const messages = this.messages();
            if (messages.length > 0) {
                // Use setTimeout to allow DOM to update
                setTimeout(() => this.scrollToBottom(), 100);
            }
        });

        // Load threads on init
        // Threads are loaded via httpResource signal

        // Effect to track elapsed time when loading
        effect(() => {
            const loading = this.isLoading();
            if (loading) {
                // Start the timer
                this.elapsedSeconds.set(0);
                this.timerInterval = setInterval(() => {
                    const startTime = this.agentService.runStartedAt();
                    if (startTime) {
                        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
                        this.elapsedSeconds.set(elapsed);
                    }
                }, 1000);
            } else {
                // Stop the timer
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
                this.elapsedSeconds.set(0);
            }
        });
    }

    // --- Event Handlers from Children ---

    async handleSendMessage(message?: string) {
        const inputContent = message || this.userInput();

        if (!inputContent.trim() || this.isLoading()) return;

        const content = inputContent;
        this.userInput.set(''); // Clear input immediately

        // Check if we are waiting for a confirmation tool response
        const pendingToolId = this.stateService.pendingConfirmationToolId();
        if (pendingToolId) {
            // Send as tool result
            this.stateService.addUserMessage(content); // Add visual user message
            // Manually update the tool call status so the UI reflects the response
            this.stateService.updateToolCallStatus(pendingToolId, 'success', content);

            // Wrap response in an object to satisfy backend validation
            const result = { response: content };
            await this.agentService.sendToolResult(pendingToolId, result);
            this.stateService.pendingConfirmationToolId.set(null); // Clear pending state
        } else {
            // Normal message
            await this.agentService.sendMessage(content);
        }
    }

    handleSuggestionSelected(suggestion: string): void {
        this.userInput.set(suggestion);
        this.handleSendMessage();
    }

    handleAddToPr(product: ProductCard): void {
        this.stateService.addProductToPr(product);
    }

    handleRemoveItem(sku: string): void {
        this.stateService.removeProductFromPr(sku);
    }

    handleUpdateQuantity(event: { sku: string; quantity: number }): void {
        this.stateService.updateItemQuantity(event.sku, event.quantity);
    }

    handleSelectSupplier(supplier: SupplierItem): void {
        this.stateService.selectSupplier(supplier);
    }

    handleRemoveSupplier(supplierId: string): void {
        this.stateService.removeSupplier(supplierId);
    }

    handleUpdatePrDetails(details: Partial<any>): void {
        this.stateService.updatePrDetails(details);
    }

    ngOnInit() {
        // Load existing conversation if available, or start fresh
        // For now, we just rely on the service state.

        // Load demo data on init
        // this.stateService.loadDemoData();

        // Check for existing thread
        const currentThreadId = this.agentService.getThreadId();
        if (currentThreadId) {
            // Ideally we would load history here if we were persisting it properly across reloads
            // For now, we just start fresh or keep in-memory state
        }

        // Trigger Test
        // this.testUpdatePrTool();
        // this.testSuggestions();
        // this.testArtifacts();
    }

    logEvents() {
        console.log('Logged Events:', this.stateService.log_events());
        localStorage.setItem('agent_events', JSON.stringify(this.stateService.log_events()));
    }


    // TEST METHOD: Verify update_pr_state tool
    /*
    testUpdatePrTool() {
        console.log('Starting Update PR Tool Test in 5 seconds...');
        setTimeout(() => {
            console.log('Simulating Full PR Update...');
            const fullUpdateArgs = {
                justification: 'Need high-performance laptops for the engineering team.',
                expectedDelivery: '2024-12-15',
                items: ['MacBook Pro 16', 'Dell XPS 15'],
                suppliers: ['TechGiant Solutions']
            };

            const toolCallId1 = 'test-call-1';

            // 1. Start Tool Call
            this.stateService.handleEvent({
                type: EventType.TOOL_CALL_START,
                toolCallId: toolCallId1,
                toolCallName: 'update_pr_state',
                messageId: 'msg-test-1'
            } as any);
            this.stateService.handleEvent({
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: toolCallId1,
                toolCallName: 'update_pr_state',
                delta: JSON.stringify(fullUpdateArgs),
                messageId: 'msg-test-1'
            } as any);

            // 2. End Tool Call (which triggers the logic)
            this.stateService.handleEvent({
                type: EventType.TOOL_CALL_END,
                toolCallId: toolCallId1,
                toolCallName: 'update_pr_state',
                delta: JSON.stringify(fullUpdateArgs),
                messageId: 'msg-test-1'
            } as any);

            toast.success('Test: Full PR Update Triggered');

            // Partial Update after another 5 seconds
            setTimeout(() => {
                console.log('Simulating Invalid PR Update (Validation Test)...');
                const invalidUpdateArgs = {
                    items: ['NonExistentLaptop'] // This should trigger validation error
                };

                const toolCallId2 = 'test-call-2';

                // 1. Start Tool Call
                this.stateService.handleEvent({
                    type: EventType.TOOL_CALL_START,
                    toolCallId: toolCallId2,
                    toolCallName: 'update_pr_state',
                    messageId: 'msg-test-2'
                } as any);

                // 2. End Tool Call
                this.stateService.handleEvent({
                    type: EventType.TOOL_CALL_END,
                    toolCallId: toolCallId2,
                    toolCallName: 'update_pr_state',
                    args: JSON.stringify(invalidUpdateArgs),
                    messageId: 'msg-test-2'
                } as any);

                toast.info('Test: Invalid PR Update Triggered (Check Console for Validation Error)');
            }, 5000);

        }, 5000);
    }
    */

    // TEST METHOD: Verify Suggestions UI
    // testSuggestions() {
    //     console.log('Simulating Suggestions...');
    //     setTimeout(() => {
    //         const suggestions = [
    //             'Show me laptops under $1000',
    //             'What are the best rated monitors?',
    //             'Add 5 Dell XPS 15 to PR'
    //         ];
    //         this.stateService.updateSuggestions(suggestions);
    //         toast.info('Test: Suggestions Triggered');
    //     }, 2000);
    // }



    // --- History Management ---
    threads = computed(() => {
        if (this.agentService.threadsResource.error()) {
            return [];
        }
        return this.agentService.threadsResource.value()?.reverse() || [];
    });
    isHistoryLoading = computed(() => this.agentService.threadsResource.isLoading());
    showHistoryModal = signal(false);

    // Current Chat Title Logic
    currentChatTitle = computed(() => {
        const currentId = this.agentService.getThreadId();
        const thread = this.threads().find(t => t.thread_id === currentId);
        return thread?.title || 'New Chat';
    });

    scrollToBottom() {
        if (this.scrollContainer) {
            this.scrollContainer.nativeElement.scrollTo({
                top: this.scrollContainer.nativeElement.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    toggleHistory() {
        this.showHistoryModal.update(v => !v);
        if (this.showHistoryModal()) {
            this.agentService.threadsResource.reload();
        }
    }

    closeHistory() {
        this.showHistoryModal.set(false);
    }

    startNewChat() {
        this.agentService.resetConversation();
        // Threads resource will auto-update if we invalidate it, but for now we just rely on it being fresh enough
        // or we could trigger a refetch if we had exposed a reload method.
        // For simple usage, we just close modal.
        this.showHistoryModal.set(false);
    }

    loadThread(threadId: string) {
        this.agentService.loadConversation(threadId);
        this.showHistoryModal.set(false);
        // Scroll to bottom after loading a thread
        setTimeout(() => this.scrollToBottom(), 100);
    }

    handleUpdateTitle(event: { thread: any, newTitle: string }) {
        const { thread, newTitle } = event;
        this.agentService.updateThreadTitle(thread.thread_id, newTitle).subscribe({
            next: () => {
                this.agentService.threadsResource.reload();
                toast.success('Thread updated');
            },
            error: (err) => {
                console.error('Failed to update title', err);
                toast.error('Failed to update thread');
            }
        });
    }

    handleDeleteThread(threadId: string) {
        this.agentService.deleteThread(threadId).subscribe({
            next: () => {
                this.agentService.threadsResource.reload();
                if (this.agentService.getThreadId() === threadId) {
                    this.startNewChat();
                }
                toast.success('Thread deleted');
            },
            error: (err) => {
                console.error('Failed to delete thread', err);
                toast.error('Failed to delete thread');
            }
        });
    }

}
