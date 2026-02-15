// edited: copy error not exposed to user; error display uses customerService.error (user-facing only).
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer/customer.service';
import { ContactService } from '../../core/services/contact/contact.service';
import { NoteService } from '../../core/services/note/note.service';
import { AuthService } from '../../core/services/auth/auth.service'; // edited: import auth for RBAC

@Component({
  selector: 'app-customer-details',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './customer-details.html',
  styleUrl: './customer-details.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDetailsPage implements OnInit, OnDestroy {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly contactService = inject(ContactService);
  private readonly noteService = inject(NoteService);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService); // edited: inject auth service for RBAC
  readonly isAdmin = this.authService.isAdmin; // edited: expose admin check - aligns with backend ADMIN authority

  readonly customer = this.customerService.customerView;
  readonly loading = this.customerService.loading;
  readonly notFound = this.customerService.notFound;
  readonly error = this.customerService.error;
  readonly hasCustomer = computed(() => !!this.customer());
  readonly contacts = computed(() => this.customer()?.contacts ?? []);
  readonly notes = computed(() => this.customer()?.notes ?? []);
  readonly activeTab = signal<'contacts' | 'notes'>('contacts');
  readonly copiedField = signal<string | null>(null);
  readonly isContactModalOpen = signal(false);
  readonly isNoteModalOpen = signal(false);

  readonly editingContactId = signal<number | null>(null);
  readonly editingNoteId = signal<number | null>(null);

  readonly viewingContact = signal<any | null>(null);
  readonly viewingNote = signal<any | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.customerService.getCustomerById(Number(id));
    }
  }

  ngOnDestroy() {
    this.customerService.clearCustomer();
  }

  viewContact(contact: any) {
    this.viewingContact.set(contact);
  }

  closeViewContact() {
    this.viewingContact.set(null);
  }

  viewNote(note: any) {
    this.viewingNote.set(note);
  }

  closeViewNote() {
    this.viewingNote.set(null);
  }

  openContactModal() {
    this.editingContactId.set(null);
    this.contactForm.reset();
    this.isContactModalOpen.set(true);
  }

  editContact(contact: any) {
    this.viewingContact.set(null);
    this.editingContactId.set(contact.id);
    this.contactForm.patchValue(contact);
    this.isContactModalOpen.set(true);
  }

  closeContactModal() {
    this.isContactModalOpen.set(false);
    this.contactForm.reset();
    this.editingContactId.set(null);
  }

  openNoteModal() {
    this.editingNoteId.set(null);
    this.noteForm.reset();
    this.isNoteModalOpen.set(true);
  }

  editNote(note: any) {
    this.viewingNote.set(null);
    this.editingNoteId.set(note.id);
    this.noteForm.patchValue({ title: note.title, content: note.content });
    this.isNoteModalOpen.set(true);
  }

  closeNoteModal() {
    this.isNoteModalOpen.set(false);
    this.noteForm.reset();
    this.editingNoteId.set(null);
  }

  async copyToClipboard(text: string | undefined, field: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedField.set(field);
      setTimeout(() => this.copiedField.set(null), 2000);
    } catch {
      // edited: do not expose copy errors to the user
    }
  }

  readonly contactForm = this.formBuilder.group({
    name: ['', Validators.required],
    position: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required]
  });

  readonly noteForm = this.formBuilder.group({
    title: ['', Validators.required],
    content: ['', Validators.required]
  });

  onSaveContact() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const formVal = this.contactForm.getRawValue();
    const editId = this.editingContactId();

    if (editId) {
      this.contactService.updateContact(editId, formVal);
    } else {
      this.contactService.addContact({ ...formVal, customerId: this.customer()?.id ?? 0 });
    }

    this.closeContactModal();
  }

  onSaveNote() {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }

    const { title, content } = this.noteForm.getRawValue();
    const editId = this.editingNoteId();

    if (editId) {
      this.noteService.updateNote(editId, { title, content });
    } else {
      const customerId = this.customer()?.id;
      if (customerId) {
        this.noteService.addNote(customerId, title, content);
      }
    }

    this.closeNoteModal();
  }

  deleteContact(id: number) {
    if (confirm('Are you sure you want to delete this contact?')) {
      this.contactService.deleteContact(id);
      this.viewingContact.set(null);
    }
  }

  deleteNote(id: number) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.noteService.deleteNote(id);
      this.viewingNote.set(null);
    }
  }

  setTab(tab: 'contacts' | 'notes') {
    this.activeTab.set(tab);
  }

  formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  isRecentNote(createdAt: string): boolean {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(createdAt).getTime() > sevenDaysAgo;
  }
}
