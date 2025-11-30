import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from 'src/environments/environments';
import { PurchaseRequisition, Artifact, SupplierItem } from '../../models/app-state.model';


import { HlmDatePickerImports } from '../../../../lib/ui/date-picker/src';
import { LucideAngularModule } from 'lucide-angular';
import { Trash2, Package2, ShoppingCart, Plus, Minus, Building2, Star, FileText, Image, Download, Eye } from 'lucide-angular';
import { SupplierCardComponent } from '../supplier-card/supplier-card.component';

@Component({
    selector: 'app-purchase-requisition-form',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, HlmDatePickerImports, SupplierCardComponent],
    templateUrl: './purchase-requisition-form.component.html',
    styleUrl: './purchase-requisition-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseRequisitionFormComponent {
    readonly icons = { Trash2, Package2, ShoppingCart, Plus, Minus, Building2, Star, FileText, Image, Download, Eye };
    prData = input.required<PurchaseRequisition>();
    artifacts = input<Artifact[]>([]);
    selectedSupplier = signal<SupplierItem | null>(null);

    // Section expansion states
    detailsExpanded = signal(true);
    justificationExpanded = signal(true);
    suppliersExpanded = signal(true);
    itemsExpanded = signal(true);
    artifactsExpanded = signal(true);

    // Outputs for user actions
    removeItem = output<string>(); // Emits SKU
    removeSupplier = output<string>(); // Emits Supplier ID
    updateQuantity = output<{ sku: string; quantity: number }>();
    updateDetails = output<Partial<PurchaseRequisition>>();
    saveDraft = output<void>();
    submitPR = output<void>();

    // Internal computed signals for display
    subtotal = computed(() =>
        this.prData().items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
    );
    tax = computed(() => this.subtotal() * this.prData().tax);
    total = computed(() => this.subtotal() + this.tax());

    // Helper to convert string date to Date object for the picker
    currentDate = computed(() => {
        const dateStr = this.prData().expectedDelivery;
        return dateStr ? new Date(dateStr) : undefined;
    });

    onDetailsChange(field: keyof PurchaseRequisition, value: string): void {
        this.updateDetails.emit({ [field]: value });
    }

    onDateChange(date: Date | undefined): void {
        if (date) {
            // Format to YYYY-MM-DD
            const formattedDate = date.toISOString().split('T')[0];
            this.updateDetails.emit({ expectedDelivery: formattedDate });
        }
    }

    onQuantityChange(sku: string, newQuantity: string): void {
        const quantity = parseInt(newQuantity, 10);
        if (!isNaN(quantity) && quantity >= 1) {
            this.updateQuantity.emit({ sku, quantity });
        }
    }

    incrementQuantity(item: any): void {
        const currentQty = item.quantity || 1;
        this.updateQuantity.emit({ sku: item.name, quantity: currentQty + 1 });
    }

    decrementQuantity(item: any): void {
        const currentQty = item.quantity || 1;
        if (currentQty > 1) {
            this.updateQuantity.emit({ sku: item.name, quantity: currentQty - 1 });
        }
    }

    viewSupplierDetails(supplier: SupplierItem): void {
        this.selectedSupplier.set(supplier);
    }

    closeSupplierDetails(): void {
        this.selectedSupplier.set(null);
    }

    toggleSection(section: 'details' | 'justification' | 'suppliers' | 'items' | 'artifacts'): void {
        switch (section) {
            case 'details':
                this.detailsExpanded.update((v) => !v);
                break;
            case 'justification':
                this.justificationExpanded.update((v) => !v);
                break;
            case 'suppliers':
                this.suppliersExpanded.update((v) => !v);
                break;
            case 'items':
                this.itemsExpanded.update((v) => !v);
                break;
            case 'artifacts':
                this.artifactsExpanded.update((v) => !v);
                break;
        }
    }

    getDownloadUrl(artifact: Artifact): string {
        if (artifact.proxy_download_url) {
            // Ensure we handle the base URL correctly. 
            // Assuming agentUrl does NOT have a trailing slash and proxy_download_url DOES start with /.
            const baseUrl = environment.agentUrl.endsWith('/') ? environment.agentUrl.slice(0, -1) : environment.agentUrl;
            const path = artifact.proxy_download_url.startsWith('/') ? artifact.proxy_download_url : `/${artifact.proxy_download_url}`;
            return `${baseUrl}${path}`;
        }
        return artifact.gcs_download_url;
    }
}
