import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { HlmSidebarTrigger } from '@spartan-ng/helm/sidebar';
import { HlmButton } from '@spartan-ng/helm/button';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    HlmSidebarTrigger,
    HlmButton
  ],
  template: `
    <header class="flex h-16 shrink-0 items-center gap-4 border-b px-4 bg-background shadow-sm z-10 relative transition-[width,height] ease-linear">
      <div class="flex items-center gap-2">
        <button hlmSidebarTrigger variant="ghost" size="icon" class="-ml-1">
          <lucide-icon name="panel-left" class="size-4"></lucide-icon>
        </button>
        <div class="h-4 w-px bg-border mx-2"></div>
        <h1 class="text-xl font-semibold text-foreground">ProcureFlow</h1>
        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">BETA</span>
      </div>
      
      <div class="ml-auto flex items-center gap-4">
        <div class="relative hidden md:block">
            <lucide-icon name="search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground "></lucide-icon>
            <input
              type="search"
              placeholder="Search requests..."
              class="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px] border border-input ml-2 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>

        <div class="flex items-center gap-2">
            <button hlmBtn variant="ghost" size="icon" (click)="themeService.toggleTheme()" class="text-foreground">
                @if (themeService.darkMode()) {
                    <lucide-icon name="moon" class="size-4"></lucide-icon>
                } @else {
                    <lucide-icon name="sun" class="size-4"></lucide-icon>
                }
            </button>
            <button hlmBtn variant="ghost" size="icon">
                <lucide-icon name="bell" class="size-4"></lucide-icon>
            </button>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  protected themeService = inject(ThemeService);
}
