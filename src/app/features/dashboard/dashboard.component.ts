import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, DollarSign, Users, CreditCard, Activity } from 'lucide-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 class="tracking-tight text-sm font-medium">Total Revenue</h3>
          <lucide-icon [img]="icons.dollar" class="h-4 w-4 text-[var(--muted-foreground)]"></lucide-icon>
        </div>
        <div class="p-6 pt-0">
          <div class="text-2xl font-bold">$45,231.89</div>
          <p class="text-xs text-[var(--muted-foreground)]">+20.1% from last month</p>
        </div>
      </div>
      <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 class="tracking-tight text-sm font-medium">Subscriptions</h3>
          <lucide-icon [img]="icons.users" class="h-4 w-4 text-[var(--muted-foreground)]"></lucide-icon>
        </div>
        <div class="p-6 pt-0">
          <div class="text-2xl font-bold">+2350</div>
          <p class="text-xs text-[var(--muted-foreground)]">+180.1% from last month</p>
        </div>
      </div>
      <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 class="tracking-tight text-sm font-medium">Sales</h3>
          <lucide-icon [img]="icons.creditCard" class="h-4 w-4 text-[var(--muted-foreground)]"></lucide-icon>
        </div>
        <div class="p-6 pt-0">
          <div class="text-2xl font-bold">+12,234</div>
          <p class="text-xs text-[var(--muted-foreground)]">+19% from last month</p>
        </div>
      </div>
      <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 class="tracking-tight text-sm font-medium">Active Now</h3>
          <lucide-icon [img]="icons.activity" class="h-4 w-4 text-[var(--muted-foreground)]"></lucide-icon>
        </div>
        <div class="p-6 pt-0">
          <div class="text-2xl font-bold">+573</div>
          <p class="text-xs text-[var(--muted-foreground)]">+201 since last hour</p>
        </div>
      </div>
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <div class="col-span-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="font-semibold leading-none tracking-tight">Overview</h3>
          <p class="text-sm text-[var(--muted-foreground)]">Monthly revenue overview.</p>
        </div>
        <div class="p-6 pt-0 pl-2">
          <!-- Chart Placeholder -->
          <div class="h-[200px] w-full bg-[var(--muted)]/20 rounded flex items-center justify-center text-[var(--muted-foreground)]">
            Chart Area
          </div>
        </div>
      </div>
      <div class="col-span-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="font-semibold leading-none tracking-tight">Recent Sales</h3>
          <p class="text-sm text-[var(--muted-foreground)]">You made 265 sales this month.</p>
        </div>
        <div class="p-6 pt-0">
          <div class="space-y-8">
            <div class="flex items-center">
              <div class="h-9 w-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <span class="text-xs font-medium">OM</span>
              </div>
              <div class="ml-4 space-y-1">
                <p class="text-sm font-medium leading-none">Olivia Martin</p>
                <p class="text-xs text-[var(--muted-foreground)]">olivia.martin@email.com</p>
              </div>
              <div class="ml-auto font-medium">+$1,999.00</div>
            </div>
            <div class="flex items-center">
              <div class="h-9 w-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <span class="text-xs font-medium">JL</span>
              </div>
              <div class="ml-4 space-y-1">
                <p class="text-sm font-medium leading-none">Jackson Lee</p>
                <p class="text-xs text-[var(--muted-foreground)]">jackson.lee@email.com</p>
              </div>
              <div class="ml-auto font-medium">+$39.00</div>
            </div>
             <div class="flex items-center">
              <div class="h-9 w-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <span class="text-xs font-medium">IN</span>
              </div>
              <div class="ml-4 space-y-1">
                <p class="text-sm font-medium leading-none">Isabella Nguyen</p>
                <p class="text-xs text-[var(--muted-foreground)]">isabella.nguyen@email.com</p>
              </div>
              <div class="ml-auto font-medium">+$299.00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  readonly icons = {
    dollar: DollarSign,
    users: Users,
    creditCard: CreditCard,
    activity: Activity
  };
}
