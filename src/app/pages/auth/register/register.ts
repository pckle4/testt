import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterPayload } from '../../../core/models/auth.model';

@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly submitRegister = output<RegisterPayload>();
  readonly formError = signal('');
  readonly isRegistering = signal(false);
  readonly registerSuccess = signal(false);

  readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    agreePrivacy: [false, Validators.requiredTrue]
  });

  readonly showPassword = signal(false);

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  onSubmit() {
    this.formError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.form.controls.agreePrivacy.value) {
        this.formError.set('You must agree to the privacy policy & terms to continue.');
        return;
      }
      this.formError.set('Please complete all required fields correctly.');
      return;
    }

    this.isRegistering.set(true);
    const { name, email, password } = this.form.getRawValue();
    this.submitRegister.emit({ name, email, password });
  }
}
