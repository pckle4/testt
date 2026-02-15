import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

/**
 * Adds Bearer token to outgoing requests. On 401, tries to refresh the access token
 * using the refresh token (backend /api/auth/refresh) and retries the request once.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('auth_token');

  const doRequest = (accessToken: string | null) => {
    const reqToSend = accessToken
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;
    return next(reqToSend).pipe(
      catchError((err: unknown) => {
        // Do not retry on 401 when the failed request was already the refresh call (avoid loop)
        const isRefreshRequest = req.url.includes('/auth/refresh');
        if (err instanceof HttpErrorResponse && err.status === 401 && !isRefreshRequest && authService.getRefreshToken()) {
          // Retry once with new token from refresh
          return authService.refreshToken().pipe(
            switchMap((res) => {
              if (res?.token) {
                const retry = req.clone({
                  setHeaders: { Authorization: `Bearer ${res.token}` }
                });
                return next(retry);
              }
              authService.logout();
              return throwError(() => err);
            }),
            catchError(() => {
              authService.logout();
              return throwError(() => err);
            })
          );
        }
        return throwError(() => err);
      })
    );
  };

  return doRequest(token);
};
