import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthUser, AuthResponse, LoginPayload, RegisterPayload } from '../../models/auth.model';

/** Key used in localStorage for refresh token (backend returns it on login/register/refresh). */
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly API = environment.apiUrl;

  private readonly userState = signal<AuthUser | null>(this.loadOrCreateMockUser());
  readonly currentUser = this.userState.asReadonly();
  readonly isAuthenticated = computed(
    () => !!this.userState() && !!localStorage.getItem('auth_token')
  );
  readonly isAdmin = computed(() => this.hasRole('ADMIN')); // edited: admin role check aligned with backend @PreAuthorize('hasAuthority("ADMIN")')

  hasRole(role: string): boolean { // edited: helper to check user roles
    return this.userState()?.roles?.includes(role) ?? false;
  }

  /** Returns the stored refresh token for use by interceptor when access token expires. */
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<any>(`${this.API}/auth/login`, payload).pipe(
      map(res => this.normalizeAuthResponse(res)),
      tap(res => {
        this.storeAuth(res);
        this.router.navigateByUrl('/dashboard');
      })
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<any>(`${this.API}/auth/register`, payload).pipe(
      map(res => this.normalizeAuthResponse(res)),
      tap(res => {
        this.storeAuth(res);
      })
    );
  }

  /**
   * Refresh access token using stored refresh token (backend POST /api/auth/refresh).
   * Used by auth interceptor on 401 to get a new token and retry the request.
   */
  refreshToken(): Observable<AuthResponse | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return of(null);
    return this.http.post<any>(`${this.API}/auth/refresh`, { refreshToken }).pipe(
      map(res => this.normalizeAuthResponse(res)),
      tap(res => this.storeAuth(res)),
      catchError(() => of(null))
    );
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('auth_user');
    this.userState.set(null);
    this.router.navigateByUrl('/auth');
  }

  private normalizeAuthResponse(raw: any): AuthResponse {
    let roles: string[] = [];
    if (Array.isArray(raw.roles)) {
      roles = raw.roles.map((r: any) => (typeof r === 'string' ? r : r.name));
    }
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      roles,
      token: raw.token,
      refreshToken: raw.refreshToken
    };
  }

  /** Store access token, refresh token, and user in localStorage and state. */
  private storeAuth(res: AuthResponse) {
    localStorage.setItem('auth_token', res.token);
    if (res.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
    const user: AuthUser = {
      id: res.id,
      name: res.name,
      email: res.email,
      roles: res.roles
    };
    localStorage.setItem('auth_user', JSON.stringify(user));
    this.userState.set(user);
  }

  /** Update current user in state and localStorage (e.g. after editing profile; UID is not changed). */
  updateCurrentUser(partial: Partial<Pick<AuthUser, 'name' | 'email'>>) {
    const current = this.userState();
    if (!current) return;
    const updated: AuthUser = { ...current, ...partial };
    localStorage.setItem('auth_user', JSON.stringify(updated));
    this.userState.set(updated);
  }

  private loadStoredUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private loadOrCreateMockUser(): AuthUser | null {
    const existing = this.loadStoredUser();
    if (existing) return existing;
    return null;
  }
}
