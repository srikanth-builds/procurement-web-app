import { Routes } from '@angular/router';
import { MainLayoutComponent } from './core/layout/main-layout.component';

export const routes: Routes = [
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () => import('./features/buying-support/pages/chat/chat').then(m => m.Chat)
            },
            // Placeholder routes pointing to dashboard for now
            {
                path: 'buying-support',
                loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'pr-clubbing',
                loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'quote-analysis',
                loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'negotiation',
                loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'purchase-order',
                loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
        ]
    }
];
