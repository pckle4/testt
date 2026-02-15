// edited: use getErrorMessage so API errors are never shown to the user; no console.error of raw errors.
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CustomerContact } from '../../models/customer.model';
import { CustomerService } from '../customer/customer.service';
import { getErrorMessage } from '../../models/api-error.model';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;
  private readonly customerService = inject(CustomerService);

  addContact(contact: Omit<CustomerContact, 'id'>) {
    return this.http.post<CustomerContact>(`${this.API}/contacts`, contact).subscribe({
      next: (savedContact) => {
        this.customerService.updateContacts((contacts) => [...contacts, savedContact]);
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to add contact. Please try again.')),
    });
  }

  getContactsByCustomerId(customerId: number) {
    return this.http.get<CustomerContact[]>(`${this.API}/contacts/customer/${customerId}`);
  }

  updateContact(id: number, contactDetails: Partial<CustomerContact>) {
    return this.http.put<CustomerContact>(`${this.API}/contacts/${id}`, contactDetails).subscribe({
      next: (updatedContact) => {
        this.customerService.updateContacts((contacts) =>
          contacts.map((c) => (c.id === id ? updatedContact : c))
        );
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to update contact. Please try again.')),
    });
  }

  deleteContact(id: number) {
    return this.http.delete(`${this.API}/contacts/${id}`).subscribe({
      next: () => {
        this.customerService.updateContacts((contacts) =>
          contacts.filter((c) => c.id !== id)
        );
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to delete contact. Please try again.')),
    });
  }
}
