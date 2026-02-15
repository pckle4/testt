// edited: use getErrorMessage so API errors are never shown to the user.
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/models/api-error.model';

interface CustomerData {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  status: string;
}

@Component({
  selector: 'app-edit-customer',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './edit-customer.html',
  styleUrl: './edit-customer.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditCustomer implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly formLoading = signal(false);
  readonly pageLoading = signal(true);
  readonly formErr = signal('');
  readonly customerId = signal<number>(0);

  readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    company: [''],
    phone: [''],
    address: [''],
    status: ['']
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.customerId.set(id);

    this.http.get<CustomerData>(`${this.API}/customers/${id}`).subscribe({
      next: (customer) => {
        this.form.patchValue({
          name: customer.name,
          email: customer.email,
          company: customer.company || '',
          phone: customer.phone || '',
          address: customer.address || '',
          status: customer.status || ''
        });
        this.pageLoading.set(false);
      },
      error: (err) => {
        this.formErr.set(getErrorMessage(err, 'Unable to load customer details. Please try again.'));
        this.pageLoading.set(false);
      }
    });
  }

  onSubmit() {
    this.formErr.set('');
    if (this.form.controls.name.invalid || this.form.controls.email.invalid) {
      this.form.controls.name.markAsTouched();
      this.form.controls.email.markAsTouched();
      this.formErr.set('Please fill in name and email correctly.');
      return;
    }

    this.formLoading.set(true);
    const { name, email } = this.form.getRawValue();

    this.http.put(`${this.API}/customers/${this.customerId()}`, {
      name,
      email,
      phone: this.form.controls.phone.value,
      company: this.form.controls.company.value,
      address: this.form.controls.address.value,
      status: this.form.controls.status.value
    }).subscribe({
      next: () => {
        this.router.navigateByUrl('/customers');
      },
      error: (err) => {
        this.formErr.set(getErrorMessage(err, 'Unable to update customer. Please try again.'));
        this.formLoading.set(false);
      }
    });
  }
}
