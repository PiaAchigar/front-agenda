import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "./auth-token";

/**
 * Modo embebido: la agenda corre dentro de un <iframe> del dashboard.
 * Se activa con `?embed=1` en la URL (el host carga `/dia?embed=1`).
 */
export const isEmbedded =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("embed") === "1";

/** Origen del dashboard (host). Se valida en cada mensaje recibido. */
const DASHBOARD_ORIGIN = import.meta.env.VITE_DASHBOARD_ORIGIN as
  | string
  | undefined;

const READY_MSG = "piubella:agenda:ready";
const TOKEN_MSG = "piubella:agenda:token";

/**
 * Handshake de token con el host:
 *  1. al montar, avisa al padre `{ type: "piubella:agenda:ready" }`.
 *  2. el host responde `{ type: "piubella:agenda:token", accessToken }`
 *     (al inicio y en cada refresh ~1h).
 *  3. guarda el token e invalida las queries para que refetcheen con auth.
 *
 * Devuelve `true` una vez recibido el primer token.
 */
export function useEmbedToken(): boolean {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (DASHBOARD_ORIGIN && e.origin !== DASHBOARD_ORIGIN) return;
      const data = e.data as { type?: string; accessToken?: unknown } | null;
      if (data?.type === TOKEN_MSG && typeof data.accessToken === "string") {
        setAuthToken(data.accessToken);
        setReady(true);
        // refetch con el token (al primer token y en cada refresh)
        void qc.invalidateQueries();
      }
    }

    window.addEventListener("message", onMessage);
    // avisar al host que estamos listos para recibir el token
    window.parent.postMessage({ type: READY_MSG }, DASHBOARD_ORIGIN ?? "*");

    if (import.meta.env.DEV && !DASHBOARD_ORIGIN) {
      console.warn(
        "[embed] VITE_DASHBOARD_ORIGIN no está seteado: no se valida el origen del host.",
      );
    }

    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  return ready;
}
