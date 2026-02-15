// edited: use getErrorMessage so API errors are never shown to the user; no console.error of raw errors.
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CustomerNote } from '../../models/customer.model';
import { CustomerService } from '../customer/customer.service';
import { getErrorMessage } from '../../models/api-error.model';

@Injectable({
  providedIn: 'root',
})
export class NoteService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;
  private readonly customerService = inject(CustomerService);

  addNote(customerId: number, title: string, content: string) {
    const payload = { customerId, title, content, createdAt: new Date().toISOString() };
    return this.http.post<CustomerNote>(`${this.API}/notes`, payload).subscribe({
      next: (savedNote) => {
        this.customerService.updateNotes((notes) => [savedNote, ...notes]);
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to add note. Please try again.')),
    });
  }

  getNotesByCustomerId(customerId: number) {
    return this.http.get<CustomerNote[]>(`${this.API}/notes/customer/${customerId}`);
  }

  updateNote(id: number, noteDetails: Partial<CustomerNote>) {
    return this.http.put<CustomerNote>(`${this.API}/notes/${id}`, noteDetails).subscribe({
      next: (updatedNote) => {
        this.customerService.updateNotes((notes) =>
          notes.map((n) => (n.id === id ? updatedNote : n))
        );
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to update note. Please try again.')),
    });
  }

  deleteNote(id: number) {
    return this.http.delete(`${this.API}/notes/${id}`).subscribe({
      next: () => {
        this.customerService.updateNotes((notes) =>
          notes.filter((n) => n.id !== id)
        );
      },
      error: (err) => this.customerService.setError(getErrorMessage(err, 'Unable to delete note. Please try again.')),
    });
  }
}
