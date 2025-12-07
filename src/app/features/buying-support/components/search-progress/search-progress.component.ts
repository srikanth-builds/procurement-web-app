import { Component, Input, ElementRef, ViewChild, AfterViewChecked, ChangeDetectionStrategy, effect, input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchProgressPanel } from '../../models/app-state.model';
import { LucideAngularModule, Search, Globe, Loader2, ChevronDown, ChevronRight, Check } from 'lucide-angular';
import { StateService } from '../../agent-state/state.service';

@Component({
  selector: 'app-search-progress',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './search-progress.component.html',
  styleUrl: './search-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchProgressComponent implements AfterViewChecked {
  panel = input.required<SearchProgressPanel>();
  private stateService = inject(StateService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  readonly icons = { Search, Globe, Loader2, ChevronDown, ChevronRight, Check };
  showAllResults = signal(false);

  toggleShowAll(event: Event) {
    event.stopPropagation();
    this.showAllResults.update(v => !v);
  }

  constructor() {
    effect(() => {
        const p = this.panel();
        // Trigger scroll on changes if needed
    });
  }

  ngAfterViewChecked() {
    if (this.panel().isExpanded) {
        this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  toggleExpanded() {
    this.stateService.toggleSearchPanel(this.panel().id);
  }

  getFaviconUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      return '';
    }
  }
}
