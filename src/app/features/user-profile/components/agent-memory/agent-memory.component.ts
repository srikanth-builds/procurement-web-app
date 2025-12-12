import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MemoryService } from '../../../../core/services/memory.service';
import { Memory, MemoryScope } from '../../../../core/models/memory.model';

@Component({
  selector: 'app-agent-memory',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './agent-memory.component.html',
  styleUrl: './agent-memory.component.scss'
})
export class AgentMemoryComponent implements OnInit {
  private memoryService = inject(MemoryService);

  // State - selectedScope tracks the service's memoryScope reactively
  selectedScope = computed(() => this.memoryService.memoryScope());
  memories = computed(() => this.memoryService.memories());
  stats = computed(() => this.memoryService.stats());
  isLoading = computed(() => this.memoryService.isLoading());
  error = computed(() => this.memoryService.error());
  totalMemories = computed(() => this.memoryService.totalMemories());
  
  // UI state
  isDeleting = signal<string | null>(null);
  isClearingAll = signal(false);
  scopeUpdating = signal(false);
  selectedCategory = signal<string | null>(null);

  // Computed
  memoriesByCategory = computed(() => {
    const mems = this.memories();
    const groups: Record<string, Memory[]> = {};
    mems.forEach(m => {
      const cat = m.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  });

  categories = computed(() => Object.keys(this.memoriesByCategory()));

  scopeOptions: { value: MemoryScope; label: string; description: string }[] = [
    { value: 'user', label: 'Personal', description: 'Memories are private to you' },
    { value: 'org', label: 'Personal + Organization', description: 'Your personal memories plus shared org knowledge' },
    { value: 'disabled', label: 'Disabled', description: 'Agent does not remember anything' }
  ];

  ngOnInit(): void {
    // Load memories on init - scope is reactively tracked from memoryService
    this.loadMemories();
  }

  loadMemories(): void {
    this.memoryService.getMemories().subscribe();
    this.memoryService.getStats().subscribe();
  }

  updateScope(scope: MemoryScope): void {
    this.scopeUpdating.set(true);
    this.memoryService.updateScope(scope).subscribe({
      next: () => {
        // selectedScope will update automatically via computed signal
        this.scopeUpdating.set(false);
      },
      error: () => {
        this.scopeUpdating.set(false);
      }
    });
  }

  deleteMemory(memoryId: string): void {
    this.isDeleting.set(memoryId);
    this.memoryService.deleteMemory(memoryId).subscribe({
      next: () => this.isDeleting.set(null),
      error: () => this.isDeleting.set(null)
    });
  }

  clearAllMemories(): void {
    if (!confirm('Are you sure you want to delete all memories? This action cannot be undone.')) {
      return;
    }
    this.isClearingAll.set(true);
    this.memoryService.clearAllMemories().subscribe({
      next: () => {
        this.isClearingAll.set(false);
        this.loadMemories();
      },
      error: () => this.isClearingAll.set(false)
    });
  }

  filterByCategory(category: string | null): void {
    this.selectedCategory.set(category);
    if (category) {
      this.memoryService.getMemories(category).subscribe();
    } else {
      this.memoryService.getMemories().subscribe();
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
