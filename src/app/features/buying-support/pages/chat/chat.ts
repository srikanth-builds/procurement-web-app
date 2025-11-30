import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { EventType } from '@ag-ui/core';
import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmResizableImports } from '../../../../lib/ui/resizable/src';
import { TextFieldModule } from '@angular/cdk/text-field';
import { LucideAngularModule } from 'lucide-angular';
import { AgentService } from '../../agent-state/agent.service';

import { ProductCard, SupplierItem } from '../../models/app-state.model';
import { ConversationStreamComponent } from '../../components/conversation-stream/conversation-stream.component';
import { PurchaseRequisitionFormComponent } from '../../components/purchase-requisition-form/purchase-requisition-form.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { HistoryComponent } from '../../components/history/history.component';
import { StateService } from '../../agent-state/state.service';
import { SuggestionsComponent } from '../../components/suggestions/suggestions.component';



@Component({
    selector: 'buying-support-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, HlmResizableImports, ConversationStreamComponent, PurchaseRequisitionFormComponent, ChatHeaderComponent, HistoryComponent, TextFieldModule, LucideAngularModule, SuggestionsComponent],
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

    // Expose state signals to the template
    state = computed(() => this.stateService.state())

    userInput = signal('');

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
        this.loadThreads();
    }

    // --- Event Handlers from Children ---

    handleSendMessage(message: string): void {
        if (!message.trim()) return;
        this.agentService.sendMessage(message);
        this.userInput.set('');
        this.stateService.clearSuggestions();
    }

    handleSuggestionSelected(suggestion: string): void {
        this.handleSendMessage(suggestion);
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
        // Load demo data on init
        // this.stateService.loadDemoData();

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
    threads = signal<any[]>([]);
    showHistoryModal = signal(false);

    // Current Chat Title Logic
    currentChatTitle = computed(() => {
        const currentId = this.agentService.getThreadId();
        const thread = this.threads().find(t => t.thread_id === currentId);
        return thread?.title || 'New Chat';
    });

    loadThreads() {
        this.agentService.getThreads().subscribe((threads) => {
            this.threads.set(threads.reverse());
            // Scroll to bottom after loading threads if needed (though usually we scroll on message load)
        });
    }

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
            this.loadThreads();
        }
    }

    closeHistory() {
        this.showHistoryModal.set(false);
    }

    startNewChat() {
        this.agentService.resetConversation();
        this.loadThreads();
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
                this.threads.update(threads =>
                    threads.map(t => t.thread_id === thread.thread_id ? { ...t, title: newTitle } : t)
                );
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
                this.threads.update(threads => threads.filter(t => t.thread_id !== threadId));
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
