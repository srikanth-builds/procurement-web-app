import { Component, Input, importProvidersFrom } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, Package2, User, ShoppingCart, Users, BarChart, Handshake, FileText, Settings, PanelLeft } from 'lucide-angular';
import {
  HlmSidebar,
  HlmSidebarContent,
  HlmSidebarFooter,
  HlmSidebarHeader,
  HlmSidebarMenu,
  HlmSidebarMenuItem,
  HlmSidebarMenuButton,
  HlmSidebarRail,
  HlmSidebarTrigger,
} from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    HlmSidebar,
    HlmSidebarContent,
    HlmSidebarFooter,
    HlmSidebarHeader,
    HlmSidebarMenu,
    HlmSidebarMenuItem,
    HlmSidebarMenuButton,
    HlmSidebarRail,
    HlmSidebarTrigger,
  ],
  template: `
    <hlm-sidebar collapsible="icon" class="border-r-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <hlm-sidebar-header class="h-16 flex items-center px-4 border-b border-sidebar-border justify-between shrink-0">
         <div class="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <lucide-icon name="package-2" class="size-5"></lucide-icon>
            </div>
            <span class="group-data-[collapsible=icon]:hidden">ProcureFlow</span>
         </div>
      </hlm-sidebar-header>

      <hlm-sidebar-content class="flex-1">
        <ul hlmSidebarMenu class="p-2 gap-1">
          @for (item of menuItems; track item.label) {
            <li hlmSidebarMenuItem>
              <a hlmSidebarMenuButton [routerLink]="item.route" routerLinkActive="bg-sidebar-accent text-sidebar-foreground" class="hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors rounded-md">
                <lucide-icon [name]="item.iconName" class="size-5"></lucide-icon>
                <span class="font-medium">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
      </hlm-sidebar-content>

      <hlm-sidebar-footer class="p-4 border-t border-sidebar-border shrink-0">
          <div class="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
             <a routerLink="/profile" class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity min-w-0">
                 <div class="relative h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium ring-2 ring-sidebar-border">
                    <img src="https://github.com/shadcn.png" alt="User" class="h-full w-full rounded-full object-cover" />
                 </div>
                 <div class="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
                    <span class="text-sm font-medium text-sidebar-foreground truncate">Sarah Johnson</span>
                    <span class="text-xs text-sidebar-foreground/70 truncate">Requestor</span>
                 </div>
             </a>
             <button class="ml-auto group-data-[collapsible=icon]:hidden text-sidebar-foreground/70 hover:text-white">
                <lucide-icon name="settings" class="size-4"></lucide-icon>
             </button>
          </div>
      </hlm-sidebar-footer>
      <button hlmSidebarRail></button>
    </hlm-sidebar>
  `
})
export class SidebarComponent {
  @Input() menuItems: any[] = [];
}
