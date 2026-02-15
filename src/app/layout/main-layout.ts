// edited: header layout (logo left, search center), mobile-friendly search modal, Tailwind-only.
// User profile badge in header shows name, roles, and dropdown with Edit Profile + Logout.
import { ChangeDetectionStrategy, Component, signal, inject, HostListener, ElementRef, ViewChild, effect, computed } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Sidebar } from '../components/sidebar/sidebar';
import { CustomerService } from '../core/services/customer/customer.service';
import { AuthService } from '../core/services/auth/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, Sidebar],
  template: `
    <app-sidebar
      [isOpen]="sidebarOpen()"
      (closeRequest)="closeSidebar()"
    />

    <!-- Backdrop (mobile only when sidebar open) -->
    <button
      type="button"
      class="fixed inset-0 z-30 bg-heading/30 backdrop-blur-sm transition-opacity md:hidden"
      [class.pointer-events-none]="!sidebarOpen()"
      [class.invisible]="!sidebarOpen()"
      [class.opacity-0]="!sidebarOpen()"
      [class.opacity-100]="sidebarOpen()"
      aria-label="Close menu"
      (click)="closeSidebar()"
    ></button>

    <!-- edited: header — logo left, search bar center -->
    <header class="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-white px-4 shadow-sm md:px-6 transition-[margin] duration-300"
      [class.md:ml-64]="sidebarOpen()">
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          (click)="toggleSidebar()"
          class="flex h-10 w-10 items-center justify-center rounded-xl text-body transition-colors hover:bg-surface hover:text-primary"
          aria-label="Toggle menu"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            @if (sidebarOpen()) {
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            } @else {
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
        <a routerLink="/dashboard" class="flex items-center no-underline">
          <span class="text-lg font-extrabold tracking-tight text-primary">CRM</span>
        </a>
      </div>

      <!-- edited: search bar hidden on mobile; visible from md up -->
      <div class="hidden md:flex flex-1 justify-center min-w-0 max-w-2xl mx-4">
        <button
          type="button"
          (click)="isSearchOpen.set(true)"
          aria-label="Open search"
          class="group flex w-full cursor-pointer items-center justify-start gap-3 rounded-full border border-border bg-bg-subtle px-5 py-3 transition-all hover:border-primary shadow-sm hover:shadow-md active:scale-[0.99] min-h-[44px]"
        >
          <svg class="h-5 w-5 shrink-0 text-body group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="flex-1 text-left text-sm font-medium text-body">Search clients, projects...</span>
          <kbd class="hidden lg:inline-flex h-6 items-center rounded-md border border-border bg-white px-2 text-[11px] font-bold text-muted shadow-sm">/</kbd>
        </button>
      </div>

      <!-- User profile badge: avatar, name, roles; dropdown with Edit Profile and Logout -->
      <div class="flex shrink-0 items-center gap-2 md:gap-4">
        <div class="relative profile-menu-container">
          <button
            type="button"
            (click)="toggleProfileMenu()"
            class="flex items-center gap-2 rounded-xl border border-transparent p-1.5 transition-all hover:bg-gray-50 focus:ring-2 focus:ring-primary/20 min-h-[44px] md:min-h-0"
            [class.bg-gray-50]="isProfileMenuOpen()"
            aria-label="User menu"
          >
            <img [src]="userAvatar()" [alt]="userName()" class="h-9 w-9 rounded-full object-cover border border-border">
            <div class="hidden text-left md:block">
              <p class="text-sm font-bold text-heading leading-tight">{{ userName() }}</p>
              <p class="text-xs font-medium text-body leading-tight">{{ rolesLabel() }}</p>
            </div>
            <svg class="h-4 w-4 text-body transition-transform duration-200 shrink-0" [class.rotate-180]="isProfileMenuOpen()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          @if (isProfileMenuOpen()) {
            <div class="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-border bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div class="px-4 py-2.5 border-b border-border">
                <p class="text-sm font-bold text-heading">{{ userName() }}</p>
                <p class="text-xs text-body mt-0.5">Roles: {{ rolesLabel() }}</p>
              </div>
              <a routerLink="/profile" (click)="closeProfileMenu()"
                class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Edit Profile
              </a>
              <button type="button" (click)="onLogout()"
                class="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          }
        </div>
      </div>
    </header>

    <!-- edited: search modal — mobile-optimized (full width, bottom-sheet style, touch targets) + desktop refined -->
    @if (isSearchOpen()) {
      <div
        class="fixed inset-0 z-50 flex md:items-start md:justify-center md:pt-24 md:pb-8 bg-heading/20 backdrop-blur-sm animate-in fade-in duration-200"
        (keydown.escape)="isSearchOpen.set(false)"
        (click)="closeSearch()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="flex flex-col w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl md:mx-4 md:rounded-2xl md:shadow-2xl md:border md:border-border bg-white overflow-hidden animate-in slide-in-from-top-4 md:slide-in-from-top-2 duration-200 rounded-t-2xl shadow-2xl"
        >
          <div class="flex flex-col flex-1 min-h-0 md:flex-row md:items-center border-b border-border">
            <div class="relative flex flex-1 items-center px-4 py-3 md:px-6 md:py-4 shrink-0">
              <svg class="absolute left-4 md:left-6 h-5 w-5 text-primary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input #searchInput type="text" [placeholder]="'Search by ' + activeFilter() + '...'"
                class="w-full bg-transparent pl-10 pr-4 py-2.5 md:py-0 text-base md:text-lg font-medium text-heading placeholder:text-muted focus:outline-none min-h-[44px] md:min-h-0"
                (keyup.enter)="onSearch($event)" (keyup.escape)="isSearchOpen.set(false)">
            </div>
            <div class="flex items-center gap-2 px-4 pb-3 md:pb-0 md:pr-4 md:py-4 flex-wrap md:flex-nowrap shrink-0">
              @for (f of filters; track f.value) {
                <button (click)="activeFilter.set(f.value)"
                  class="rounded-full px-3 py-2 md:py-1.5 text-xs font-bold transition-all whitespace-nowrap min-h-[36px] md:min-h-0 touch-manipulation"
                  [class.bg-primary]="activeFilter() === f.value" [class.text-white]="activeFilter() === f.value"
                  [class.bg-surface]="activeFilter() !== f.value" [class.text-body]="activeFilter() !== f.value"
                  [class.hover:bg-primary-light]="activeFilter() !== f.value">
                  {{ f.label }}
                </button>
              }
              <button type="button" (click)="closeSearch()"
                class="rounded-lg bg-surface px-3 py-2 md:py-1.5 text-[11px] font-bold uppercase text-body hover:bg-gray-200 active:bg-gray-300 cursor-pointer shrink-0 transition-colors select-none min-h-[36px] md:min-h-0 touch-manipulation">Close</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 md:p-6 pb-6">
            <p class="mb-3 md:mb-4 text-[11px] md:text-xs font-bold uppercase tracking-wider text-muted">Quick Links</p>
            <div class="grid gap-2">
              <button (click)="navigateTo('/dashboard')"
                class="flex items-center gap-3 rounded-xl px-4 py-3.5 md:py-2.5 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors min-h-[48px] md:min-h-0 touch-manipulation active:scale-[0.99]">
                <svg class="h-5 w-5 md:h-4 md:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </button>
              <button (click)="navigateTo('/customers')"
                class="flex items-center gap-3 rounded-xl px-4 py-3.5 md:py-2.5 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors min-h-[48px] md:min-h-0 touch-manipulation active:scale-[0.99]">
                <svg class="h-5 w-5 md:h-4 md:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                All Customers
              </button>
              <button (click)="navigateTo('/add-customer')"
                class="flex items-center gap-3 rounded-xl px-4 py-3.5 md:py-2.5 text-left text-sm font-medium text-body hover:bg-bg-subtle hover:text-primary transition-colors min-h-[48px] md:min-h-0 touch-manipulation active:scale-[0.99]">
                <svg class="h-5 w-5 md:h-4 md:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Main content -->
    <main class="min-h-[calc(100vh-4rem)] transition-[margin] duration-300"
      [class.md:ml-64]="sidebarOpen()">
      <router-outlet />
    </main>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly authService = inject(AuthService);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  readonly sidebarOpen = signal(false);
  readonly isSearchOpen = signal(false);
  readonly isProfileMenuOpen = signal(false);
  readonly activeFilter = signal('all');

  /** Display name for header profile badge */
  readonly userName = computed(() => this.authService.currentUser()?.name ?? 'Guest');
  /** Comma-separated list of roles for header profile badge */
  readonly rolesLabel = computed(() => {
    const roles = this.authService.currentUser()?.roles ?? [];
    return roles.length ? roles.join(', ') : 'User';
  });
  readonly userAvatar = computed(() => {
    const name = this.userName().replace(/\s/g, '+');
    return `https://ui-avatars.com/api/?name=${name}&background=E0E7FF&color=5955D1`;
  });

  toggleProfileMenu() {
    this.isProfileMenuOpen.update((v) => !v);
  }

  closeProfileMenu() {
    this.isProfileMenuOpen.set(false);
  }

  onLogout() {
    this.closeProfileMenu();
    if (confirm('Are you sure you want to log out?')) {
      this.authService.logout();
    }
  }

  readonly filters = [
    { label: 'All', value: 'all' },
    { label: 'Name', value: 'name' },
    { label: 'Email', value: 'email' },
    { label: 'Company', value: 'company' },
  ];

  constructor() {
    effect(() => {
      if (this.isSearchOpen()) {
        setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 50);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const t = event.target as HTMLElement;
    if (this.isProfileMenuOpen() && t && !t.closest('.profile-menu-container')) {
      this.closeProfileMenu();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent) {
    // edited: do not open search on mobile (search bar is hidden there)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (event.key === '/' && !isMobile && !this.isSearchOpen() && !this.isInputActive()) {
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

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
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
      all: '',
      name: 'name',
      email: 'email',
      company: 'company',
    };
    const field = filterMap[this.activeFilter()] ?? '';
    this.customerService.setSearch(query, field);
    this.router.navigate(['/customers']);
    this.isSearchOpen.set(false);
  }
}
