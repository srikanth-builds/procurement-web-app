import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AgentService } from '../../agent-state/agent.service';

@Component({
    selector: 'app-resource-exhausted-error',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    template: `
    <div class="mx-4 mb-4 p-4 border border-amber-200 bg-amber-50/90 backdrop-blur-sm rounded-xl flex items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-amber-100 rounded-full">
          <lucide-icon name="clock" class="text-amber-600 size-5"></lucide-icon>
        </div>
        <div class="text-sm">
          <p class="font-semibold text-amber-900">High Traffic</p>
          <p class="text-amber-700">Our AI agents are currently busy. Please continue to resume.</p>
        </div>
      </div>
      <button 
        (click)="retry()" 
        class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm active:scale-95">
        Continue
      </button>
    </div>
  `
})
export class ResourceExhaustedErrorComponent {
    private agentService = inject(AgentService);

    retry() {
        this.agentService.retryLastAction();
    }
}
