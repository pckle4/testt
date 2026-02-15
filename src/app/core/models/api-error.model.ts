// edited: central API error handling — never expose technical/HTTP messages to the UI.

export interface ApiError {
  errorCode: string;
  message: string;
  field?: string;
  timestamp: string;
  path: string;
}

/** Returns true if the value looks like our backend ApiError shape. */
export function isApiError(error: any): error is ApiError {
  return error && typeof error.errorCode === 'string' && typeof error.message === 'string';
}

/** True if the string looks like a technical HTTP/network message we must not show. */
function isTechnicalMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('http failure') ||
    lower.includes('unknown error') ||
    lower.includes('failure response') ||
    lower.includes('status code') ||
    lower.includes('network error') ||
    /^\d+\s+\w+\s+error/i.test(msg)
  );
}

/**
 * Returns a safe, user-facing error message. Never returns raw API/HTTP errors (e.g. "Http failure response for ... 0 Unknown Error").
 * Use this for every place we display errors to the user.
 */
export function getErrorMessage(error: any, fallback: string = 'Something went wrong. Please try again.'): string {
  // edited: handle HTTP status 0 (network/CORS/server unreachable) with a friendly message
  const status = error?.status;
  if (typeof status === 'number' && status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }
  if (typeof status === 'number' && status === 404) {
    return 'The requested item was not found.';
  }

  // Backend API error body (our ApiError shape) — use only if message is safe
  if (error?.error && isApiError(error.error) && typeof error.error.message === 'string') {
    const msg = error.error.message.trim();
    if (msg.length > 0 && !isTechnicalMessage(msg)) return msg;
  }
  if (isApiError(error) && typeof error.message === 'string') {
    const msg = error.message.trim();
    if (msg.length > 0 && !isTechnicalMessage(msg)) return msg;
  }

  // Generic error.message only if it's not a technical leak
  if (typeof error?.message === 'string') {
    const msg = error.message.trim();
    if (msg.length > 0 && !isTechnicalMessage(msg)) return msg;
  }

  return fallback;
}
