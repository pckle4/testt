// Edit profile page: current user can edit name and email. UID is read-only and not editable.
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-edit-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly formErr = signal('');
  readonly formLoading = signal(false);

  readonly form = this.formBuilder.group({
    // UID is not part of form — shown read-only in template, not editable
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  /** User ID displayed read-only (not editable as per requirement). */
  readonly userId = computed(() => this.authService.currentUser()?.id ?? '');

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigateByUrl('/auth');
      return;
    }
    const user = this.authService.currentUser();
    this.form.patchValue({ name: user?.name ?? '', email: user?.email ?? '' });
  }

  onSubmit() {
    this.formErr.set('');
    if (this.form.controls.name.invalid || this.form.controls.email.invalid) {
      this.form.controls.name.markAsTouched();
      this.form.controls.email.markAsTouched();
      this.formErr.set('Please fill in name and a valid email.');
      return;
    }

    this.formLoading.set(true);
    const { name, email } = this.form.getRawValue();

    // Update frontend state and localStorage; backend profile update can be added later
    this.authService.updateCurrentUser({ name, email });
    this.formLoading.set(false);
    this.router.navigateByUrl('/dashboard');
  }
}
