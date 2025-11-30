import { Component, inject, input, output, signal } from '@angular/core';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { SupplierItem } from '../../models/app-state.model';
import { SupplierCardComponent } from '../supplier-card/supplier-card.component';
import { SupplierComparisonModalComponent } from '../supplier-comparison-modal/supplier-comparison-modal.component';
import { StateService } from '../../agent-state/state.service';
import {
    HlmCarousel,
    HlmCarouselContent,
    HlmCarouselItem,
    HlmCarouselNext,
    HlmCarouselPrevious,
} from '@spartan-ng/helm/carousel';
import { LucideAngularModule } from 'lucide-angular';


@Component({
    selector: 'app-supplier-carousel',
    standalone: true,
    imports: [
        CommonModule,
        SupplierCardComponent,
        SupplierComparisonModalComponent,
        HlmCarousel,
        HlmCarouselContent,
        HlmCarouselItem,
        HlmCarouselNext,
        HlmCarouselPrevious,
        LucideAngularModule
    ],
    template: `
    <div class="relative group space-y-4">
        <div class="flex justify-end">
            <button (click)="openComparisonModal()"
                class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                <lucide-icon name="arrow-left-right" class="size-4"></lucide-icon>
                Compare Suppliers
            </button>
        </div>

        <hlm-carousel #carousel class="w-full" [options]="{ align: 'start', loop: false }">
            <hlm-carousel-content class="-ml-4">
                @for (supplier of suppliers(); track supplier.id) {
                <hlm-carousel-item class="pl-4 basis-1/2 md:basis-1/2 lg:basis-1/3">
                    <app-supplier-card [supplier]="supplier"
                        (select)="handleSelectSupplier(supplier)" (viewDetails)="openComparisonModal()"></app-supplier-card>
                </hlm-carousel-item>
                }
            </hlm-carousel-content>
            <button hlm-carousel-previous></button>
            <button hlm-carousel-next></button>
        </hlm-carousel>
        
        <div class="flex justify-center mt-4">
            <span class="text-xs text-muted-foreground font-medium">
                {{ getPaginationText(carousel.currentSlide(), suppliers().length) }}
            </span>
        </div>
    </div>

    <app-supplier-comparison-modal [isOpen]="isComparisonModalOpen()" [suppliers]="suppliers()"
        (close)="closeComparisonModal()" (select)="handleSelectSupplier($event)"></app-supplier-comparison-modal>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
        }
    `]
})
export class SupplierCarouselComponent {
    suppliers = input.required<SupplierItem[]>();
    selectSupplier = output<SupplierItem>();
    stateService = inject(StateService);

    handleSelectSupplier(supplier: SupplierItem): void {
        this.selectSupplier.emit(supplier);
    }

    // Comparison Modal state
    isComparisonModalOpen = signal(false);

    openComparisonModal(): void {
        this.isComparisonModalOpen.set(true);
    }

    closeComparisonModal(): void {
        this.isComparisonModalOpen.set(false);
    }
    // Pagination Logic
    private breakpointObserver = inject(BreakpointObserver);
    private visibleItems = signal(3); // Default to 3 (lg)

    constructor() {
        this.breakpointObserver.observe([
            '(min-width: 1024px)',
            '(min-width: 768px)'
        ]).subscribe((result: BreakpointState) => {
            if (result.breakpoints['(min-width: 1024px)']) {
                this.visibleItems.set(3);
            } else if (result.breakpoints['(min-width: 768px)']) {
                this.visibleItems.set(2);
            } else {
                this.visibleItems.set(2); // Default mobile/sm
            }
        });
    }

    getPaginationText(currentIndex: number, total: number): string {
        const start = currentIndex + 1;
        const end = Math.min(currentIndex + this.visibleItems(), total);
        return `${start} to ${end} of ${total} suppliers`;
    }
}
