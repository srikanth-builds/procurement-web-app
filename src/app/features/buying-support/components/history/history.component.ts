import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { HlmDialog } from '../../../../lib/ui/dialog/src/lib/hlm-dialog';
import { HlmDialogContent } from '../../../../lib/ui/dialog/src/lib/hlm-dialog-content';
import { HlmDialogHeader } from '../../../../lib/ui/dialog/src/lib/hlm-dialog-header';
import { HlmDialogFooter } from '../../../../lib/ui/dialog/src/lib/hlm-dialog-footer';
import { HlmDialogTitle } from '../../../../lib/ui/dialog/src/lib/hlm-dialog-title';
import { HlmDialogDescription } from '../../../../lib/ui/dialog/src/lib/hlm-dialog-description';
import { HlmDialogImports } from '../../../../lib/ui/dialog/src';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        LucideAngularModule,
        BrnDialogImports,
        HlmDialogImports,
        HlmDialog,
        HlmDialogContent,
        HlmDialogHeader,
        HlmDialogFooter,
        HlmDialogTitle,
        HlmDialogTitle,
        HlmDialogDescription,
        RelativeTimePipe
    ],
    templateUrl: './history.component.html',
    styleUrl: './history.component.scss'
})
export class HistoryComponent {
    threads = input.required<any[], any[]>({ transform: (value) => [...value].reverse() });
    isOpen = input.required<boolean>();

    close = output<void>();
    selectThread = output<string>();
    updateTitle = output<{ thread: any, newTitle: string }>();
    deleteThread = output<string>();

    editingThreadId = signal<string | null>(null);
    editTitle = signal<string>('');

    startEditing(thread: any, event: Event) {
        event.stopPropagation();
        this.editingThreadId.set(thread.thread_id);
        this.editTitle.set(thread.title || 'New Chat');
    }

    cancelEditing(event?: Event) {
        event?.stopPropagation();
        this.editingThreadId.set(null);
        this.editTitle.set('');
    }

    saveTitle(thread: any, event: Event) {
        event.stopPropagation();
        const newTitle = this.editTitle().trim();
        if (newTitle && newTitle !== thread.title) {
            this.updateTitle.emit({ thread, newTitle });
            this.editingThreadId.set(null);
        } else {
            this.cancelEditing(event);
        }
    }

    onDeleteThread(thread: any, event: Event) {
        event.stopPropagation();
        this.deleteThread.emit(thread.thread_id);
    }
}
