import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside
      class="fixed left-0 top-0 z-40 h-screen w-64 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
      [class.-translate-x-full]="!isOpen()"
      [class.translate-x-0]="isOpen()"
      style="border-right: 1px solid var(--color-border);"
    >
      <!-- Sidebar header: logo matches header (grid icon + CRM) -->
      <div class="flex h-16 shrink-0 items-center border-b border-border bg-surface/50 px-5 py-4">
        <a
          routerLink="/dashboard"
          (click)="onNavClick()"
          class="flex items-center gap-2.5 rounded-lg no-underline transition-opacity hover:opacity-90"
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/25">
            <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </span>
          <span class="text-xl font-bold tracking-tight text-heading">CRM</span>
        </a>
      </div>

      <!-- edited: nav section label and improved link styling -->
      <div class="flex-1 overflow-y-auto px-3 py-4">
        <p class="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">Menu</p>
        <nav class="flex flex-col gap-1">
          <a
            routerLink="/dashboard"
            routerLinkActive="!bg-primary/10 !text-primary !shadow-sm ring-1 ring-primary/20"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="onNavClick()"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-body transition-all duration-200 hover:bg-surface hover:text-primary active:scale-[0.99]"
          >
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </span>
            Dashboard
          </a>
          <a
            routerLink="/customers"
            routerLinkActive="!bg-primary/10 !text-primary !shadow-sm ring-1 ring-primary/20"
            (click)="onNavClick()"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-body transition-all duration-200 hover:bg-surface hover:text-primary active:scale-[0.99]"
          >
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            Customers
          </a>
          <a
            routerLink="/add-customer"
            routerLinkActive="!bg-primary/10 !text-primary !shadow-sm ring-1 ring-primary/20"
            (click)="onNavClick()"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-body transition-all duration-200 hover:bg-surface hover:text-primary active:scale-[0.99]"
          >
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </span>
            Add Customer
          </a>
        </nav>
      </div>

      <!-- Logout only in header profile dropdown (drawer), not in sidebar -->
    </aside>
  `,
  styles: [],
})
export class Sidebar {
  readonly isOpen = input<boolean>(true);
  readonly closeRequest = output<void>();

  onNavClick() {
    this.closeRequest.emit();
  }
}
