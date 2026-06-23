/**
 * Holder del access token a nivel módulo.
 *
 * En modo embebido (dentro del dashboard) el token llega por `postMessage`
 * desde el host (ver `embed.ts`). El cliente de API (`api/client.ts`) lo lee
 * en cada request para mandar el header `Authorization`.
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}
