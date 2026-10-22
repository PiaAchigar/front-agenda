import { getAuthToken } from "../lib/auth-token";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  status: number;
  /** Algunos endpoints (p. ej. el lote de turnos) dicen qué ítem falló. */
  indice?: number;

  constructor(status: number, message: string, indice?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.indice = indice;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const { headers: initHeaders, ...rest } = init ?? {};

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...initHeaders,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; indice?: number } | null;
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.indice);
  }
  return res.json() as Promise<T>;
}
