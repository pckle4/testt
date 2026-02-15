import { Component, inject, signal, computed, HostListener, ElementRef, ViewChild, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CustomerService } from '../../core/services/customer/customer.service';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <header class="relative z-40 flex h-20 items-center justify-between border-b border-border bg-white px-6 md:px-8">
      <a routerLink="/dashboard" class="flex items-center select-none shrink-0 cursor-pointer no-underline">
        <span class="text-2xl font-extrabold tracking-tight text-primary">CRM</span>
      </a>

      <div class="hidden md:flex items-center w-full max-w-2xl mx-6">
        <div (click)="isSearchOpen.set(true)"
          class="group flex flex-1 cursor-pointer items-center gap-3 rounded-full border border-border bg-bg-subtle px-5 py-2.5 transition-all hover:border-primary hover:shadow-md active:scale-[0.99]">
          <svg class="h-5 w-5 text-body group-hover:text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="text-sm font-medium text-body flex-1">Search clients, projects...</span>
          <kbd class="hidden sm:inline-flex h-6 items-center rounded-md border border-border bg-white px-2 text-[11px] font-bold text-muted shadow-sm">/</kbd>
        </div>
      </div>

      <div class="flex items-center gap-6">
        <button class="relative rounded-xl p-2.5 text-body hover:bg-bg-subtle hover:text-primary transition-colors">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary"></span>
        </button>

        <div class="relative">
          <button (click)="toggleProfileMenu()"
            class="flex items-center gap-3 rounded-xl border border-transparent p-1 transition-all hover:bg-gray-50 focus:ring-2 focus:ring-primary/20"
            [class.bg-gray-50]="isProfileMenuOpen()">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
              <img [src]="userAvatar()" [alt]="userName()" class="h-10 w-10 rounded-full">
            </div>
            <div class="hidden text-left md:block">
              <p class="text-sm font-bold text-heading">{{ userName() }}</p>
              <p class="text-xs font-medium text-body">{{ userRole() }}</p>
            </div>
            <svg class="h-4 w-4 text-body transition-transform duration-200" [class.rotate-180]="isProfileMenuOpen()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          @if (isProfileMenuOpen()) {
          <div class="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-border bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-100 z-50">
            <a href="#" class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Edit Profile
            </a>
            <button (click)="onLogout()" class="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
          }
        </div>
      </div>
    </header>

    @if (isSearchOpen()) {
    <div class="fixed inset-0 z-50 flex items-start justify-center bg-heading/20 backdrop-blur-sm pt-20 animate-in fade-in duration-200" (keydown.escape)="isSearchOpen.set(false)">
      <div class="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-in slide-in-from-top-4 duration-200">
        <div class="flex items-center border-b border-border">
          <div class="relative flex flex-1 items-center px-6 py-4">
            <svg class="absolute left-6 h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input #searchInput type="text" [placeholder]="'Search by ' + activeFilter() + '...'"
              class="h-full w-full bg-transparent pl-10 pr-4 text-lg font-medium text-heading placeholder:text-muted focus:outline-none"
              (keyup.enter)="onSearch($event)" (keyup.escape)="isSearchOpen.set(false)" cdkFocusInitial>
          </div>
          <div class="flex items-center gap-1.5 pr-4">
            @for (f of filters; track f.value) {
            <button (click)="activeFilter.set(f.value)"
              class="rounded-full px-3 py-1 text-xs font-bold transition-all whitespace-nowrap text-body hover:bg-bg-subtle"
              [class.bg-primary]="activeFilter() === f.value" [class.text-white]="activeFilter() === f.value"
              [class.bg-surface]="activeFilter() !== f.value" [class.text-body]="activeFilter() !== f.value"
              [class.hover:bg-primary-light]="activeFilter() !== f.value">
              {{ f.label }}
            </button>
            }
            <button type="button" (click)="closeSearch()"
              class="ml-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] font-bold uppercase text-body hover:bg-gray-200 active:bg-gray-300 cursor-pointer shrink-0 transition-colors select-none">ESC</button>
          </div>
        </div>

        <div class="p-6">
          <p class="mb-4 text-xs font-bold uppercase tracking-wider text-muted">Quick Links</p>
          <div class="grid gap-2">
            <button (click)="navigateTo('/dashboard')"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Dashboard
            </button>
            <button (click)="navigateTo('/customers')"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              All Customers
            </button>
            <button (click)="navigateTo('/add-customer')"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Customer
            </button>
          </div>
        </div>
      </div>
      <div (click)="isSearchOpen.set(false)" class="absolute inset-0 -z-10"></div>
    </div>
    }
  `,
  styles: ``,
})
export class Header {
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly authService = inject(AuthService);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  readonly isSearchOpen = signal(false);
  readonly isProfileMenuOpen = signal(false);
  readonly searchResults = signal<string[]>([]);
  readonly activeFilter = signal('all');

  private readonly focusEffect = effect(() => {
    if (this.isSearchOpen()) {
      setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 50);
    }
  });

  readonly filters = [
    { label: 'All', value: 'all' },
    { label: 'Name', value: 'name' },
    { label: 'Email', value: 'email' },
    { label: 'Company', value: 'company' },
  ];

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent) {
    if (event.key === '/' && !this.isSearchOpen() && !this.isInputActive()) {
      event.preventDefault();
      this.isSearchOpen.set(true);
    }
    if (event.key === 'Escape' && this.isSearchOpen()) {
      this.isSearchOpen.set(false);
    }
  }

  private isInputActive(): boolean {
    const tag = document.activeElement?.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  readonly userName = computed(() => this.authService.currentUser()?.name ?? 'Guest');
  readonly userRole = computed(() => this.authService.currentUser()?.roles?.[0] ?? 'User');
  readonly userAvatar = computed(() => {
    const name = this.userName().replace(/\s/g, '+');
    return `https://ui-avatars.com/api/?name=${name}&background=E0E7FF&color=5955D1`;
  });

  toggleProfileMenu() {
    this.isProfileMenuOpen.update(v => !v);
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  navigateTo(path: string) {
    this.isSearchOpen.set(false);
    this.router.navigateByUrl(path);
  }

  onSearch(event: Event) {
    event.preventDefault();
    const query = (event.target as HTMLInputElement).value;

    const filterMap: Record<string, string> = {
      'all': '',
      'name': 'name',
      'email': 'email',
      'company': 'company',
    };

    let field = filterMap[this.activeFilter()] ?? '';

    // Just pass the query and mapped field to service
    this.customerService.setSearch(query, field);

    // Navigate to customers page if not there
    this.router.navigate(['/customers']);
    this.isSearchOpen.set(false);
  }

  onLogout() {
    if (confirm('Are you sure you want to log out?')) {
      this.isProfileMenuOpen.set(false);
      this.authService.logout();
    }
  }
}
