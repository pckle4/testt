import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginPayload } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly submitLogin = output<LoginPayload>();
  readonly formError = signal('');
  readonly isLoggingIn = signal(false);
  readonly loginSuccess = signal(false);

  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly showPassword = signal(false);

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  onSubmit() {
    this.formError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please enter a valid email and password.');
      return;
    }

    this.isLoggingIn.set(true);
    this.submitLogin.emit(this.form.getRawValue());
  }
}
