import { Component, computed, inject, input, output, signal } from '@angular/core';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { ProductOption } from '../../models/app-state.model';
import { ProductOptionCardComponent } from '../product-option-card/product-option-card.component';
import { ProductComparisonModalComponent } from '../product-comparison-modal/product-comparison-modal.component';
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
    selector: 'app-product-carousel',
    standalone: true,
    imports: [
        CommonModule,
        ProductOptionCardComponent,
        ProductComparisonModalComponent,
        HlmCarousel,
        HlmCarouselContent,
        HlmCarouselItem,
        HlmCarouselNext,
        HlmCarouselPrevious,
        LucideAngularModule
    ],
    templateUrl: './product-carousel.component.html',
    styleUrl: './product-carousel.component.scss'
})
export class ProductCarouselComponent {
    products = input.required<ProductOption[]>();
    stateService = inject(StateService);

    // Check if a product is already in the PR
    isProductInPr(product: ProductOption): boolean {
        const prItems = this.stateService.state().purchaseRequisition.items;
        // Check by SKU if available, otherwise by name (fallback)
        return prItems.some(item =>
            (item.sku && product.sku && item.sku === product.sku) ||
            item.name === product.name
        );
    }

    addToPr = output<ProductOption>();

    handleAddToPr(product: ProductOption): void {
        if (!this.isProductInPr(product)) {
            this.addToPr.emit(product);
        }
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
        return `${start} to ${end} of ${total} products`;
    }
}
