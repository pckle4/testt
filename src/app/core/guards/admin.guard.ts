import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

// edited: temporary admin check disabled — no auth backend; allow everyone. Re-enable block below when auth is ready.
export const adminGuard: CanActivateFn = () => {
  // const authService = inject(AuthService);
  // const router = inject(Router);
  // if (authService.isAdmin()) {
  //   return true;
  // }
  // router.navigateByUrl('/customers');
  // return false;

  return true; // edited: allow Add Customer / Edit Customer without admin role
};
