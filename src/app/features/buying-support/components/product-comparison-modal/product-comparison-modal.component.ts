import { Component, input, output, computed } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ProductOption } from '../../models/app-state.model';
import { formatLabel } from '../../../../shared/utils/format-utils';
import { LucideAngularModule } from 'lucide-angular';
import { StateService } from '../../agent-state/state.service';
import { inject } from '@angular/core';

@Component({
    selector: 'app-product-comparison-modal',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage, LucideAngularModule],
    templateUrl: './product-comparison-modal.component.html',
    styleUrl: './product-comparison-modal.component.scss'
})
export class ProductComparisonModalComponent {
    products = input.required<ProductOption[]>();
    isOpen = input(false);
    close = output<void>();
    addToPr = output<ProductOption>();

    private stateService = inject(StateService);

    isProductInPr(product: ProductOption): boolean {
        const prItems = this.stateService.state().purchaseRequisition.items;
        return prItems.some(item =>
            (item.sku && product.sku && item.sku === product.sku) ||
            item.name === product.name
        );
    }

    // Compute unique specification keys from all products
    specKeys = computed(() => {
        const keys = new Set<string>();
        this.products().forEach(p => {
            if (p.specifications) {
                p.specifications.forEach(s => keys.add(s.key));
            } else if (p.specs) {
                Object.keys(p.specs).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys);
    });

    recommendedProductIndex = computed(() => {
        return this.products().findIndex(p => this.isRecommended(p));
    });

    // Helper to get a safe image URL or placeholder
    getImageUrl(product: ProductOption): string {
        return product.image_url || 'assets/placeholder-product.png';
    }

    isRecommended(product: ProductOption): boolean {
        // return false;
        const index = this.products().indexOf(product);
        // Mocking 1st and 3rd products as recommended for testing
        return index === 0 || index === 2 || (product as any).status?.toLowerCase() === 'recommended';
    }

    getSpecValue(product: ProductOption, key: string): string {
        if (product.specifications) {
            return product.specifications.find(s => s.key === key)?.value || '-';
        } else if (product.specs) {
            return product.specs[key] || '-';
        }
        return '-';
    }

    formatKey(key: string): string {
        return formatLabel(key);
    }

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close.emit();
        }
    }
}
