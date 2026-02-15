import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, HostListener, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer/customer.service';
import { AuthService } from '../../core/services/auth/auth.service'; // edited: import auth for RBAC
import { environment } from '../../../environments/environment';
// edited: use getErrorMessage so API errors are never shown to the user.
import { getErrorMessage } from '../../core/models/api-error.model';

export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  status: string;
  avatar: string;
}

@Component({
  selector: 'app-customers',
  imports: [RouterLink],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Customers implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;
  private readonly route = inject(ActivatedRoute);
  private readonly customerService = inject(CustomerService);
  private readonly authService = inject(AuthService); // edited: inject auth service for RBAC
  readonly isAdmin = this.authService.isAdmin; // edited: expose admin check - aligns with backend ADMIN authority

  readonly customersList = signal<CustomerSummary[]>([]);
  readonly loading = signal(false);
  readonly fetchError = signal('');
  readonly totalFilteredCount = signal(0);
  readonly openMenuId = signal<number | null>(null);

  // Use service signals
  readonly searchQuery = this.customerService.searchQuery;
  readonly searchField = this.customerService.searchField;

  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly sortColumn = signal<string | null>(null);
  readonly sortDirection = signal<'asc' | 'desc' | null>(null);

  readonly dropdownPosition = signal<{ top: number; left: number } | null>(null);

  readonly totalPages = computed(() => Math.ceil(this.totalFilteredCount() / this.pageSize()) || 1);

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    if (total > 1) pages.push(total);

    return pages;
  });

  readonly customers = this.customersList;

  private searchDebounceTimer: any = null;

  constructor() {
    // React to search changes
    effect(() => {
      const query = this.searchQuery();
      const field = this.searchField();
      // Reset page on search change
      this.currentPage.set(1);
      // Allow the effect to trigger fetch? 
      // Actually, fetch depends on these signals.
      // We can just call fetchCustomers() inside the effect (using untracked if needed to avoid loops, but here we want reaction)
      // However, `fetchCustomers` reads the signals.
      // Let's use `untracked` for things we don't want to double trigger?
      // Actually, easiest is just call `fetchCustomers` whenever these change.
      untracked(() => {
        this.fetchCustomers();
      });
    });
  }

  ngOnInit() {
    // route params subscription removed as we rely on service state now
    this.fetchCustomers();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  onSearchInput(value: string) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      // Update service instead of local signal
      this.customerService.setSearch(value, this.searchField());
      // fetchCustomers will be triggered by effect
    }, 300);
  }

  onSearchFieldChange(value: string) {
    // Update service
    this.customerService.setSearch(this.searchQuery(), value);
  }

  fetchCustomers() {
    this.loading.set(true);
    this.fetchError.set('');

    const params = new URLSearchParams({
      search: this.searchQuery(),
      searchField: this.searchField() || 'all', // edited: always send actual field value, was sending '' for 'all' causing backend mismatch
      page: String(this.currentPage() - 1),
      size: String(this.pageSize())
    });

    if (this.sortColumn() && this.sortDirection()) {
      params.set('sortBy', this.sortColumn()!);
      params.set('sortDir', this.sortDirection()!);
    }

    this.http.get<{ data: Omit<CustomerSummary, 'avatar'>[]; total: number; page: number; size: number }>(
      `${this.API}/customers?${params.toString()}`
    ).subscribe({
      next: (res) => {
        this.customersList.set(
          res.data.map(c => ({
            ...c,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=E0E7FF&color=5955D1`
          }))
        );
        this.totalFilteredCount.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.fetchError.set(getErrorMessage(err, 'Unable to load customers. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  handleSort(column: string) {
    if (this.sortColumn() === column) {
      if (this.sortDirection() === 'desc') {
        this.sortDirection.set('asc');
      } else if (this.sortDirection() === 'asc') {
        this.sortColumn.set(null);
        this.sortDirection.set(null);
      }
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
    this.fetchCustomers();
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.fetchCustomers();
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.fetchCustomers();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.fetchCustomers();
    }
  }

  firstPage() {
    this.goToPage(1);
  }

  lastPage() {
    this.goToPage(this.totalPages());
  }

  toggleMenu(id: number, event: Event) {
    event.stopPropagation();

    if (this.openMenuId() === id) {
      this.openMenuId.set(null);
      this.dropdownPosition.set(null);
      return;
    }

    const button = (event.currentTarget as HTMLElement);
    const rect = button.getBoundingClientRect();

    this.dropdownPosition.set({
      top: rect.bottom + 4,
      left: rect.right - 160
    });

    this.openMenuId.set(id);
  }

  @HostListener('window:scroll')
  onScroll() {
    if (this.openMenuId() !== null) {
      this.openMenuId.set(null);
    }
  }

  deleteCustomer(id: number) {
    if (confirm('Are you sure you want to delete this customer?')) {
      this.http.delete(`${this.API}/customers/${id}`).subscribe({
        next: () => {
          this.fetchCustomers();
        },
        error: (err) => {
          this.fetchError.set(getErrorMessage(err, 'Unable to delete customer. Please try again.'));
          setTimeout(() => this.fetchError.set(''), 5000);
        }
      });
    }
  }

  clearSearch() {
    this.customerService.setSearch('', 'all');
    this.currentPage.set(1);
    this.fetchCustomers();
  }
}
