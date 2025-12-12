import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { 
  Memory, 
  MemoryListResponse, 
  MemoryStats, 
  MemoryScope, 
  MemoryScopeResponse 
} from '../models/memory.model';
import { Observable, tap, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MemoryService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.agentUrl}api/memory`;

  // Reactive state
  memoryScope = signal<MemoryScope>('user');
  memories = signal<Memory[]>([]);
  stats = signal<MemoryStats | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Memory event signals (set by StateService when CUSTOM events arrive)
  memoryPreloadedCount = signal<number | null>(null);
  memorySavedStatus = signal<boolean>(false);

  // Computed
  totalMemories = computed(() => this.stats()?.total_memories || 0);
  isMemoryEnabled = computed(() => this.memoryScope() !== 'disabled');

  constructor() {
    this.loadScope();
  }

  /**
   * Load current memory scope from backend
   */
  loadScope(): void {
    this.http.get<MemoryScopeResponse>(`${this.baseUrl}/scope`)
      .pipe(
        catchError(err => {
          console.warn('Failed to load memory scope, using default', err);
          return of({ scope: 'user' as MemoryScope, valid_options: ['user', 'org', 'disabled'] as MemoryScope[] });
        })
      )
      .subscribe(response => {
        this.memoryScope.set(response.scope);
        // Also persist to localStorage for immediate access
        localStorage.setItem('memory_scope', response.scope);
      });
  }

  /**
   * Update memory scope preference
   */
  updateScope(scope: MemoryScope): Observable<MemoryScopeResponse> {
    return this.http.patch<MemoryScopeResponse>(`${this.baseUrl}/scope`, { scope })
      .pipe(
        tap(response => {
          this.memoryScope.set(response.scope);
          localStorage.setItem('memory_scope', response.scope);
        })
      );
  }

  /**
   * Get list of memories with optional filters
   */
  getMemories(category?: string, limit: number = 50): Observable<MemoryListResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    let url = `${this.baseUrl}/`;
    const params: string[] = [];
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length) url += `?${params.join('&')}`;

    return this.http.get<MemoryListResponse>(url)
      .pipe(
        tap(response => {
          this.memories.set(response.memories);
          this.isLoading.set(false);
        }),
        catchError(err => {
          this.error.set('Failed to load memories');
          this.isLoading.set(false);
          throw err;
        })
      );
  }

  /**
   * Get memory statistics
   */
  getStats(): Observable<MemoryStats> {
    return this.http.get<MemoryStats>(`${this.baseUrl}/stats`)
      .pipe(
        tap(stats => this.stats.set(stats))
      );
  }

  /**
   * Delete a single memory
   */
  deleteMemory(memoryId: string): Observable<{ status: string; memory_id: string }> {
    return this.http.delete<{ status: string; memory_id: string }>(`${this.baseUrl}/${memoryId}`)
      .pipe(
        tap(() => {
          // Remove from local state
          this.memories.update(mems => mems.filter(m => m.id !== memoryId));
          // Update stats
          if (this.stats()) {
            this.stats.update(s => s ? { ...s, total_memories: s.total_memories - 1 } : null);
          }
        })
      );
  }

  /**
   * Clear all memories
   */
  clearAllMemories(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/`)
      .pipe(
        tap(() => {
          this.memories.set([]);
          this.stats.set(null);
        })
      );
  }

  /**
   * Handle memory_preloaded event
   */
  handleMemoryPreloaded(count: number): void {
    this.memoryPreloadedCount.set(count);
    // Clear after a few seconds
    setTimeout(() => this.memoryPreloadedCount.set(null), 5000);
  }

  /**
   * Handle memory_saved event
   */
  handleMemorySaved(): void {
    this.memorySavedStatus.set(true);
    // Clear after animation
    setTimeout(() => this.memorySavedStatus.set(false), 3000);
  }
}
