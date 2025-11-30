import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ShoppingCart, Users, BarChart, Handshake, FileText, Menu, Bell, Settings, User, Package2, Search, ChevronRight } from 'lucide-angular';
import { cn } from '../lib/utils';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
    templateUrl: './layout.component.html',
    styleUrl: './layout.component.scss'
})
export class LayoutComponent {
    sidebarOpen = true;

    readonly icons = {
        menu: Menu,
        bell: Bell,
        settings: Settings,
        user: User,
        logo: Package2,
        search: Search,
        chevronRight: ChevronRight
    };

    menuItems = [
        { label: 'Buying Support', route: '/buying-support', icon: ShoppingCart },
        { label: 'PR Clubbing', route: '/pr-clubbing', icon: Users },
        { label: 'Quote Analysis', route: '/quote-analysis', icon: BarChart },
        { label: 'Negotiation', route: '/negotiation', icon: Handshake },
        { label: 'Purchase Order', route: '/purchase-order', icon: FileText }
    ];

    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
    }
}

