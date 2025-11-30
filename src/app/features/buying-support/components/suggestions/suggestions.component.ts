import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Sparkles } from 'lucide-angular';
import {
  HlmCarousel,
  HlmCarouselContent,
  HlmCarouselItem,
  HlmCarouselNext,
  HlmCarouselPrevious,
} from '@spartan-ng/helm/carousel';

@Component({
  selector: 'app-suggestions',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    HlmCarousel,
    HlmCarouselContent,
    HlmCarouselItem,
    HlmCarouselNext,
    HlmCarouselPrevious
  ],
  template: `
    @if ((suggestions() ?? []).length > 0) {
    <div class="suggestions-wrapper">
      <hlm-carousel #carousel class="w-full" [options]="{ align: 'start', loop: false, dragFree: true }">
        <hlm-carousel-content class="-ml-2">
          @for (suggestion of suggestions(); track suggestion) {
          <hlm-carousel-item class="pl-2 basis-auto">
            <button class="suggestion-chip  text-primary!" (click)="suggestionSelected.emit(suggestion)">
              <lucide-icon name="sparkles" class="size-3.5 mr-2 text-primary"></lucide-icon>
              {{ suggestion }}
            </button>
          </hlm-carousel-item>
          }
        </hlm-carousel-content>

        @if (carousel.canScrollPrev()) {
          <button hlm-carousel-previous class="left-0 z-10 bg-background/80 backdrop-blur-sm border shadow-sm h-8 w-8"></button>
        }
        @if (carousel.canScrollNext()) {
          <button hlm-carousel-next class="right-0 z-10 bg-background/80 backdrop-blur-sm border shadow-sm h-8 w-8"></button>
        }
      </hlm-carousel>
    </div>
    }
  `,
  styleUrls: ['./suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsComponent {
  readonly icons = { Sparkles };
  suggestions = input<string[]>();
  suggestionSelected = output<string>();
}
