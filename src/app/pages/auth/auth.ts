// edited: use getErrorMessage so API errors are never shown to the user.
import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';
import { LoginPayload, RegisterPayload } from '../../core/models/auth.model';
import { getErrorMessage } from '../../core/models/api-error.model';
import { LoginForm } from './login/login';
import { RegisterForm } from './register/register';

export type AuthTab = 'login' | 'register';

@Component({
  selector: 'app-auth',
  imports: [LoginForm, RegisterForm],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthPage {
  private readonly authService = inject(AuthService);

  readonly activeTab = signal<AuthTab>('login');
  readonly showPassword = signal(false);

  @ViewChild(LoginForm) loginFormComponent!: LoginForm;
  @ViewChild(RegisterForm) registerFormComponent!: RegisterForm;

  setTab(tab: AuthTab) {
    this.activeTab.set(tab);
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  handleLogin(payload: LoginPayload) {
    this.authService.login(payload).subscribe({
      next: () => {
        if (this.loginFormComponent) {
          this.loginFormComponent.loginSuccess.set(true);
          this.loginFormComponent.isLoggingIn.set(false);
        }
      },
      error: (err) => {
        if (this.loginFormComponent) {
          this.loginFormComponent.isLoggingIn.set(false);
          this.loginFormComponent.formError.set(getErrorMessage(err, 'Login failed. Please check your credentials.'));
        }
      }
    });
  }

  handleRegister(payload: RegisterPayload) {
    this.authService.register(payload).subscribe({
      next: () => {
        if (this.registerFormComponent) {
          this.registerFormComponent.isRegistering.set(false);
          this.registerFormComponent.registerSuccess.set(true);
          setTimeout(() => {
            this.registerFormComponent.registerSuccess.set(false);
            this.activeTab.set('login');
          }, 2000);
        }
      },
      error: (err) => {
        if (this.registerFormComponent) {
          this.registerFormComponent.isRegistering.set(false);
          this.registerFormComponent.formError.set(getErrorMessage(err, 'Registration failed. Please try again.'));
        }
      }
    });
  }
}
