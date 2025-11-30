import { Component, input, output } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ProductOption } from '../../models/app-state.model';
import { formatLabel } from '../../../../shared/utils/format-utils';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-product-option-card',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage, LucideAngularModule],
    templateUrl: './product-option-card.component.html',
    styleUrl: './product-option-card.component.scss'
})
export class ProductOptionCardComponent {
    product = input.required<ProductOption>();
    isAdded = input(false);
    addToPr = output<ProductOption>();

    // Helper to get a safe image URL or placeholder
    get imageUrl(): string {
        return this.product().image_url || 'assets/placeholder-product.png'; // Ensure you have a placeholder
    }

    get isRecommended(): boolean {
        // Check if status is 'Recommended' (case-insensitive)
        return (this.product() as any).status?.toLowerCase() === 'recommended';
    }

    formatKey(key: string): string {
        return formatLabel(key);
    }
}
