// edited: use getErrorMessage so API errors are never shown raw to the user.
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { getErrorMessage } from '../../models/api-error.model';
import {
  Customer,
  CustomerDetails,
  CustomerView,
  CustomerContact,
  CustomerNote,
  CustomerResponse
} from '../../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  private readonly customersListState = signal<Customer[]>([]);
  private readonly totalCustomersState = signal(0);
  private readonly customerViewState = signal<CustomerView | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly notFoundState = signal(false);

  readonly customersList = computed(() => this.customersListState());
  readonly totalCustomers = computed(() => this.totalCustomersState());
  readonly customerView = computed(() => this.customerViewState());
  readonly loading = computed(() => this.loadingState());
  readonly error = computed(() => this.errorState());
  readonly notFound = computed(() => this.notFoundState());

  // Search State
  private readonly searchQueryState = signal('');
  private readonly searchFieldState = signal('all');

  readonly searchQuery = computed(() => this.searchQueryState());
  readonly searchField = computed(() => this.searchFieldState());

  setSearch(query: string, field: string) {
    this.searchQueryState.set(query);
    this.searchFieldState.set(field);
  }

  setError(message: string) {
    this.errorState.set(message);
    setTimeout(() => this.errorState.set(''), 5000);
  }

  getCustomers(page = 0, size = 10, search = '', searchField = 'all', sortBy = 'id', sortDir = 'desc') {
    this.loadingState.set(true);
    this.errorState.set('');
    const params: any = { page, size, search, searchField, sortBy, sortDir };

    this.http.get<CustomerResponse>(`${this.API}/customers`, { params }).subscribe({
      next: (response) => {
        this.customersListState.set(response.data);
        this.totalCustomersState.set(response.total);
        this.loadingState.set(false);
      },
      error: (err) => {
        this.errorState.set(getErrorMessage(err, 'Unable to load customers. Please try again.'));
        this.loadingState.set(false);
      },
    });
  }

  getCustomerById(id: number) {
    this.loadingState.set(true);
    this.errorState.set('');
    this.notFoundState.set(false);
    this.http.get<Customer>(`${this.API}/customers/${id}`).subscribe({
      next: (customer) => {
        const view: CustomerView = {
          ...customer,
          contacts: [],
          notes: [],
        };
        this.customerViewState.set(view);
        this.loadingState.set(false);

        this.loadContactsAndNotes(id);
      },
      error: (err) => {
        if (err?.status === 404) {
          this.notFoundState.set(true);
          this.errorState.set('Customer not found.');
        } else {
          this.errorState.set(getErrorMessage(err, 'Unable to load customer details. Please try again.'));
        }
        this.loadingState.set(false);
      },
    });
  }

  addCustomer(customerDetails: CustomerDetails) {
    this.loadingState.set(true);
    this.errorState.set('');
    return this.http.post<Customer>(`${this.API}/customers`, customerDetails);
  }

  updateCustomer(id: number, customerDetails: Partial<CustomerDetails>) {
    this.errorState.set('');
    return this.http.put<Customer>(`${this.API}/customers/${id}`, customerDetails);
  }

  deleteCustomer(id: number) {
    this.errorState.set('');
    return this.http.delete(`${this.API}/customers/${id}`);
  }


  clearCustomer() {
    this.customerViewState.set(null);
    this.notFoundState.set(false);
    this.errorState.set('');
  }


  updateContacts(updater: (contacts: CustomerContact[]) => CustomerContact[]) {
    this.customerViewState.update((view) => {
      if (!view) return view;
      const contacts = updater(view.contacts);
      return { ...view, contacts };
    });
  }


  updateNotes(updater: (notes: CustomerNote[]) => CustomerNote[]) {
    this.customerViewState.update((view) => {
      if (!view) return view;
      const notes = updater(view.notes);
      return { ...view, notes };
    });
  }


  private loadContactsAndNotes(customerId: number) {
    this.http
      .get<{ data: CustomerContact[] }>(`${this.API}/contacts/customer/${customerId}`)
      .subscribe({
        next: (response) => this.updateContacts(() => response.data ?? []),
        error: (err) => this.setError(getErrorMessage(err, 'Unable to load contacts.')),
      });

    this.http
      .get<{ data: CustomerNote[] }>(`${this.API}/notes/customer/${customerId}`)
      .subscribe({
        next: (response) => this.updateNotes(() => response.data ?? []),
        error: (err) => this.setError(getErrorMessage(err, 'Unable to load notes.')),
      });
  }
}
