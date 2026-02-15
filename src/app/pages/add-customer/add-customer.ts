// edited: use getErrorMessage so API errors are never shown to the user.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer/customer.service';
import { getErrorMessage } from '../../core/models/api-error.model';

@Component({
  selector: 'app-add-customer',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './add-customer.html',
  styleUrl: './add-customer.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddCustomer {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);

  readonly formLoading = signal(false);
  readonly formErr = signal('');

  readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    company: ['', Validators.required],
    phone: ['', Validators.required],
    address: [''],

  });

  onSubmit() {
    this.formErr.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formErr.set('Please fill in all required fields.');
      return;
    }

    this.formLoading.set(true);
    const formValue = this.form.getRawValue();
    const customerPayload = { ...formValue, status: 'Active' };

    this.customerService.addCustomer(customerPayload).subscribe({
      next: () => {
        this.form.reset();
        this.router.navigateByUrl('/customers');
      },
      error: (err) => {
        this.formErr.set(getErrorMessage(err, 'Unable to add customer. Please try again.'));
        this.formLoading.set(false);
      },
    });
  }
}
