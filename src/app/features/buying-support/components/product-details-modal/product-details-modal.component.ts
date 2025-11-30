import { Component, input, output } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ProductOption } from '../../models/app-state.model';
import { formatLabel } from '../../../../shared/utils/format-utils';

@Component({
    selector: 'app-product-details-modal',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage],
    templateUrl: './product-details-modal.component.html',
    styleUrl: './product-details-modal.component.scss'
})
export class ProductDetailsModalComponent {
    product = input.required<ProductOption>();
    isOpen = input(false);
    close = output<void>();
    addToPr = output<ProductOption>();

    // Helper to get a safe image URL or placeholder
    get imageUrl(): string {
        return this.product().image_url || 'assets/placeholder-product.png';
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
