import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupplierItem } from '../../models/app-state.model';
import { LucideAngularModule, Trash2, CheckCircle, Plus } from 'lucide-angular';

@Component({
  selector: 'app-supplier-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex flex-col h-full p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md"
         [class.border-primary]="supplier().status === 'Preferred'"
         [class.bg-primary\/5]="supplier().status === 'Preferred'">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="font-semibold text-lg leading-tight">{{ supplier().name }}</h3>
          <div class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <lucide-icon name="map-pin" class="size-3"></lucide-icon>
            <span>{{ supplier().location }}</span>
          </div>
        </div>
        @if (supplier().status === 'Preferred') {
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary text-primary-foreground">
            Preferred
          </span>
        } @else {
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            {{ supplier().status }}
          </span>
        }
      </div>

      <!-- Details -->
      <div class="space-y-2 mb-4 flex-1">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Rating</span>
          <div class="flex items-center gap-1">
            <lucide-icon name="star" class="size-3 fill-amber-500 text-amber-500"></lucide-icon>
            <span class="font-medium">{{ supplier().rating }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Contact</span>
          <span class="font-medium truncate max-w-[120px]" [title]="supplier().contact">{{ supplier().contact }}</span>
        </div>
      </div>

      <!-- Actions -->
      @if (showActions() || showRemove()) {
        <div class="flex gap-2 mt-auto">
          @if (showActions()) {
            <button (click)="select.emit(supplier())"
              class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                  [class.bg-primary]="!supplier().selected"
                  [class.text-primary-foreground]="!supplier().selected"
                  [class.hover:bg-primary/90]="!supplier().selected"
                  [class.bg-green-100]="supplier().selected"
                  [class.text-green-700]="supplier().selected"
                  [class.hover:bg-green-200]="supplier().selected">
	              @if (supplier().selected) {
                    <lucide-icon name="check-circle" class="size-4"></lucide-icon>
                    Selected
                  } @else {
                    <lucide-icon name="plus" class="size-4"></lucide-icon>
                    Select
                  }
	            </button>
            @if (showCompare()) {
            <button (click)="viewDetails.emit(supplier())"
                class="inline-flex items-center justify-center p-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Compare">
                <lucide-icon name="arrow-left-right" class="size-4"></lucide-icon>
            </button>
            }
          }
          @if (showRemove()) {
             <button (click)="remove.emit(supplier().id)"
              class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors">
              <lucide-icon name="trash-2" class="size-4"></lucide-icon>
              Remove
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class SupplierCardComponent {
  supplier = input.required<SupplierItem>();
  showActions = input(true);
  showRemove = input(false);
  showCompare = input(false); // Default to false as per user feedback

  select = output<SupplierItem>();
  viewDetails = output<SupplierItem>();
  remove = output<string>(); // Emits ID
}
