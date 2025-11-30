import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HlmSidebarWrapper, HlmSidebarInset } from '@spartan-ng/helm/sidebar';
import { SidebarComponent } from './sidebar/sidebar.component';
import { HeaderComponent } from './header/header.component';
import { ShoppingCart, Users, BarChart, Handshake, FileText, Package2, User, PanelLeft, Bell, Search } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterOutlet,
    HlmSidebarWrapper,
    HlmSidebarInset,
    SidebarComponent,
    HeaderComponent,
    LucideAngularModule
  ],
  template: `
    <hlm-sidebar-wrapper>
      <app-sidebar [menuItems]="menuItems"></app-sidebar>
      <main hlmSidebarInset>
        <app-header></app-header>
        <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <router-outlet></router-outlet>
        </div>
      </main>
    </hlm-sidebar-wrapper>
  `
})
export class MainLayoutComponent {
  menuItems = [
    { label: 'Buying Support', route: '/buying-support', iconName: 'shopping-cart' },
    { label: 'PR Clubbing', route: '/pr-clubbing', iconName: 'users' },
    { label: 'Quote Analysis', route: '/quote-analysis', iconName: 'bar-chart' },
    { label: 'Negotiation', route: '/negotiation', iconName: 'handshake' },
    { label: 'Purchase Order', route: '/purchase-order', iconName: 'file-text' }
  ];

  // Register icons for the layout
  readonly icons = {
    ShoppingCart, Users, BarChart, Handshake, FileText, Package2, User, PanelLeft, Bell, Search
  };
}
