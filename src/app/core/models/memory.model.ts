export interface Memory {
  id: string;
  fact: string;
  category: string;
  created_at: string;
  source_session: string;
}

export interface MemoryListResponse {
  total: number;
  memories: Memory[];
  categories: Record<string, number>;
}

export interface MemoryStats {
  total_memories: number;
  categories: Record<string, number>;
  oldest_memory: string;
  newest_memory: string;
  memory_scope: string;
}

export interface MemoryScopeResponse {
  scope: MemoryScope;
  valid_options: MemoryScope[];
}

export type MemoryScope = 'user' | 'org' | 'disabled';
