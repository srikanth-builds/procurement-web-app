
import { Component, inject, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Check, X, Edit2, SendHorizontal, PackageCheck } from 'lucide-angular';
import { AgentService } from '../../agent-state/agent.service';
import { StateService } from '../../agent-state/state.service';
import { ToolCallState } from '../../models/app-state.model';
import { BrnHoverCard, BrnHoverCardContent, BrnHoverCardTrigger } from '@spartan-ng/brain/hover-card';
import { HlmHoverCardImports } from '@spartan-ng/helm/hover-card';

@Component({
    selector: 'app-confirmation-tool',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, BrnHoverCard, BrnHoverCardTrigger, BrnHoverCardContent, HlmHoverCardImports],
    template: `
    <div class="flex flex-col gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20 shadow-sm">
        <div class="flex items-start gap-3">
            <div class="p-2 rounded-full bg-accent/20 text-accent-foreground shrink-0 mt-0.5">
                <lucide-icon name="package-check" class="size-6"></lucide-icon>
            </div>
            <div class="flex-1 space-y-1">
                <h4 class="text-sm font-medium text-foreground">Confirmation Required</h4>
                <p class="text-sm text-muted-foreground leading-relaxed">{{ actionDescription() }}</p>
            </div>
        </div>

        <!-- Actions -->
        @if (!hasResponded()) {
            <div class="flex flex-wrap items-center gap-2 pl-11">
                <!-- Yes -->
                <button (click)="onYes()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <lucide-icon name="check" class="size-3.5"></lucide-icon>
                    Yes, proceed
                </button>

                <!-- No -->
                <button (click)="onNo()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors shadow-sm">
                    <lucide-icon name="x" class="size-3.5"></lucide-icon>
                    No
                </button>

                <!-- Refine -->
                <button (click)="toggleRefine()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors shadow-sm">
                    <lucide-icon name="edit-2" class="size-3.5"></lucide-icon>
                    Refine
                </button>
            </div>

            <!-- Refine Input -->
            @if (isRefining()) {
                <div class="flex items-center gap-2 pl-11 mt-1 animate-in fade-in slide-in-from-top-1">
                    <input 
                        #refineInput
                        type="text" 
                        [(ngModel)]="refineText" 
                        (keydown.enter)="onRefineSubmit()"
                        placeholder="How should we proceed instead?" 
                        class="flex-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                    <button (click)="onRefineSubmit()" [disabled]="!refineText()" class="inline-flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50">
                        <lucide-icon name="send-horizontal" class="size-3.5"></lucide-icon>
                    </button>
                </div>
            }
        } @else {
            @if (responseType() === 'yes') {
                <div class="pl-11 flex items-center gap-2 text-xs text-green-600 font-medium animate-in fade-in slide-in-from-top-1">
                    <lucide-icon name="check" class="size-3.5"></lucide-icon>
                    Confirmed
                </div>
            } @else if (responseType() === 'no') {
                <div class="pl-11 flex items-center gap-2 text-xs text-red-600 font-medium animate-in fade-in slide-in-from-top-1">
                    <lucide-icon name="x" class="size-3.5"></lucide-icon>
                    Cancelled
                </div>
            } @else {
                <div class="pl-11 flex items-center gap-2 text-xs text-muted-foreground italic animate-in fade-in slide-in-from-top-1">
                    <lucide-icon name="edit-2" class="size-3.5"></lucide-icon>
                    @if (isTruncated()) {
                        <brn-hover-card>
                            <span brnHoverCardTrigger class="cursor-help underline decoration-dotted underline-offset-2">
                                Refined: "{{ responseText() }}"
                            </span>
                            <hlm-hover-card-content *brnHoverCardContent class="w-80">
                                <div class="space-y-2">
                                    <h4 class="text-sm font-semibold">Full Refinement</h4>
                                    <p class="text-sm text-muted-foreground break-words">
                                        {{ fullResponseText() }}
                                    </p>
                                </div>
                            </hlm-hover-card-content>
                        </brn-hover-card>
                    } @else {
                        <span>Refined: "{{ responseText() }}"</span>
                    }
                </div>
            }
        }
    </div>
    `,
    styles: []
})
export class ConfirmationToolComponent {
    toolCall = input.required<ToolCallState>();

    agentService = inject(AgentService);
    stateService = inject(StateService);

    isRefining = signal(false);
    refineText = signal('');
    hasResponded = signal(false);

    // Rich response state
    responseType = signal<'yes' | 'no' | 'refine' | null>(null);
    responseText = signal('');
    fullResponseText = signal('');
    isTruncated = signal(false);

    actionDescription = signal('');

    constructor() {
        effect(() => {
            const tc = this.toolCall();
            // Parse args
            try {
                const parsed = JSON.parse(tc.args);
                this.actionDescription.set(parsed.descriptive_action || 'Please confirm this action.');
            } catch (e) {
                this.actionDescription.set('Please confirm this action.');
            }

            // Check status
            if (tc.status === 'success' || tc.status === 'error') {
                this.hasResponded.set(true);
                
                let resString = '';
                if (typeof tc.result === 'string') {
                    try {
                         // Try parsing if it's a JSON string
                        const parsed = JSON.parse(tc.result);
                        if (parsed && typeof parsed === 'object' && 'response' in parsed) {
                             resString = parsed.response;
                        } else {
                             resString = tc.result;
                        }
                    } catch (e) {
                         resString = tc.result;
                    }
                } else if (typeof tc.result === 'object' && tc.result !== null) {
                    if ('response' in tc.result) {
                        resString = tc.result.response;
                    } else {
                        resString = JSON.stringify(tc.result);
                    }
                } else {
                    resString = JSON.stringify(tc.result);
                }

                if (resString.toLowerCase() === 'yes') {
                    this.responseType.set('yes');
                    this.responseText.set('Confirmed');
                } else if (resString.toLowerCase() === 'no') {
                    this.responseType.set('no');
                    this.responseText.set('Cancelled');
                } else {
                    this.responseType.set('refine');
                    // Normalize: remove "Refined: " prefix if present (from internal input)
                    let text = resString;
                    if (text.startsWith('Refined: ')) {
                        text = text.substring(9).trim();
                    }

                    this.fullResponseText.set(text);

                    // Truncate to 50 chars
                    if (text.length > 50) {
                        this.isTruncated.set(true);
                        text = text.substring(0, 50) + '...';
                    } else {
                        this.isTruncated.set(false);
                    }
                    this.responseText.set(text);
                }
            }
        });
    }

    onYes() {
        this.sendResponse('Yes');
    }

    onNo() {
        this.sendResponse('No');
    }

    toggleRefine() {
        this.isRefining.update(v => !v);
    }

    onRefineSubmit() {
        if (this.refineText().trim()) {
            this.sendResponse(`Refined: ${this.refineText()} `);
        }
    }

    private sendResponse(response: string) {
        // Optimistic update
        this.hasResponded.set(true);

        if (response === 'Yes') {
            this.responseType.set('yes');
            this.responseText.set('Confirmed');
        } else if (response === 'No') {
            this.responseType.set('no');
            this.responseText.set('Cancelled');
        } else {
            this.responseType.set('refine');
            let text = response;
            if (text.startsWith('Refined: ')) {
                text = text.substring(9).trim();
            }
            
            this.fullResponseText.set(text);

            if (text.length > 50) {
                this.isTruncated.set(true);
                text = text.substring(0, 50) + '...';
            } else {
                this.isTruncated.set(false);
            }
            this.responseText.set(text);
        }

        // Wrap response in an object to satisfy backend validation
        const result = { response: response };
        this.agentService.sendToolResult(this.toolCall().toolCallId, result);
        
        // Clear pending confirmation state to prevent subsequent messages from being sent as tool results
        if (this.stateService.pendingConfirmationToolId() === this.toolCall().toolCallId) {
            this.stateService.pendingConfirmationToolId.set(null);
        }
    }
}
