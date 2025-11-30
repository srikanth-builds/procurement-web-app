import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupplierItem } from '../../models/app-state.model';
import { LucideAngularModule, CheckCircle, Plus } from 'lucide-angular';
@Component({
    selector: 'app-supplier-comparison-modal',
    standalone: true,
    imports: [
        CommonModule,
        LucideAngularModule,
    ],
    template: `
    @if (isOpen()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop animate-in fade-in duration-200"
        (click)="onBackdropClick($event)">
        <div class="bg-background rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col m-4 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b">
                <h2 class="text-lg font-semibold">Compare Suppliers</h2>
                <button (click)="close.emit()" class="p-2 hover:bg-muted rounded-full transition-colors">
                    <lucide-icon name="x" class="size-5"></lucide-icon>
                </button>
            </div>

            <div class="flex-1 overflow-x-auto overflow-y-auto p-1">
                <table class="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            <th class="p-3 text-left bg-muted/50 border-b min-w-[150px] sticky left-0 z-10 backdrop-blur-sm">Feature</th>
                            @for (supplier of suppliers(); track supplier.id) {
                            <th class="p-3 text-left border-b min-w-[200px] bg-background"
                                [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                <div class="font-semibold text-base">{{ supplier.name }}</div>
                                @if (supplier.status === 'Preferred') {
                                <div class="text-xs text-primary font-medium mt-1">Preferred Choice</div>
                                }
                            </th>
                            }
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Rating -->
                        <tr class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 font-medium border-b bg-muted/20 sticky left-0 backdrop-blur-sm">Rating</td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                <div class="flex items-center gap-1">
                                    <lucide-icon name="star" class="size-4 fill-amber-500 text-amber-500"></lucide-icon>
                                    <span class="font-medium">{{ supplier.rating }}</span>
                                </div>
                            </td>
                            }
                        </tr>

                        <!-- Status -->
                        <tr class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 font-medium border-b bg-muted/20 sticky left-0 backdrop-blur-sm">Status</td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                    [ngClass]="{
                                        'bg-primary text-primary-foreground': supplier.status === 'Preferred',
                                        'bg-green-100 text-green-700': supplier.status === 'Approved',
                                        'bg-yellow-100 text-yellow-700': supplier.status === 'Probation',
                                        'bg-blue-100 text-blue-700': supplier.status === 'New'
                                    }">
                                    {{ supplier.status }}
                                </span>
                            </td>
                            }
                        </tr>

                        <!-- Location -->
                        <tr class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 font-medium border-b bg-muted/20 sticky left-0 backdrop-blur-sm">Location</td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                {{ supplier.location }}
                            </td>
                            }
                        </tr>

                        <!-- Contact -->
                        <tr class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 font-medium border-b bg-muted/20 sticky left-0 backdrop-blur-sm">Contact</td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                {{ supplier.contact }}
                            </td>
                            }
                        </tr>

                         <!-- Website -->
                         <tr class="hover:bg-muted/50 transition-colors">
                            <td class="p-3 font-medium border-b bg-muted/20 sticky left-0 backdrop-blur-sm">Website</td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                <a *ngIf="supplier.website" [href]="supplier.website" target="_blank" class="text-primary hover:underline flex items-center gap-1">
                                    Visit <lucide-icon name="external-link" class="size-3"></lucide-icon>
                                </a>
                                <span *ngIf="!supplier.website" class="text-muted-foreground">-</span>
                            </td>
                            }
                        </tr>

                            <!-- Action -->
                        <tr>
                            <td class="p-3 border-b bg-muted/20 sticky left-0 backdrop-blur-sm"></td>
                            @for (supplier of suppliers(); track supplier.id) {
                            <td class="p-3 border-b" [class.bg-primary\/5]="supplier.status === 'Preferred'">
                                <button (click)="handleSelect(supplier)"
                                    class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                                    [class.bg-primary]="!supplier.selected"
                                    [class.text-primary-foreground]="!supplier.selected"
                                    [class.hover:bg-primary/90]="!supplier.selected"
                                    [class.bg-green-100]="supplier.selected"
                                    [class.text-green-700]="supplier.selected"
                                    [class.hover:bg-green-200]="supplier.selected">
                                    @if (supplier.selected) {
                                    <lucide-icon name="check-circle" class="size-4"></lucide-icon>
                                    Selected
                                    } @else {
                                    <lucide-icon name="plus" class="size-4"></lucide-icon>
                                    Select
                                    }
                                </button>
                            </td>
                            }
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    }
    `
})
export class SupplierComparisonModalComponent {
    isOpen = input.required<boolean>();
    suppliers = input.required<SupplierItem[]>();
    close = output<void>();
    select = output<SupplierItem>();

    handleSelect(supplier: SupplierItem) {
        this.select.emit(supplier);
        // Do not close on select to allow multiple selections/toggling
        // this.close.emit(); 
    }

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }
}
