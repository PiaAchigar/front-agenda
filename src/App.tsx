import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DayViewPage } from "./features/day-view/DayViewPage";
import { WeekViewPage } from "./features/week-view/WeekViewPage";
import { MonthViewPage } from "./features/month-view/MonthViewPage";
import { getSavedView } from "./components/ViewTabs";
import { isEmbedded, useEmbedToken } from "./lib/embed";
import { destinoDeArranque, rutaGuardada, useRecordarRuta } from "./lib/ruta-recordada";

const CLAVE_DE_RUTA = "piubella:agenda:ruta";

/**
 * La raíz: no dibuja nada, sólo decide a dónde ir.
 *
 * Primero, la pantalla exacta donde estaba antes de recargar —incluido el día
 * que estaba mirando, que viaja en la query. Si no hay ninguna, la última
 * vista elegida, que es lo que se hacía antes.
 *
 * **Antes renderizaba el día acá mismo** en vez de redirigir, y eso dejaba la
 * URL en "/" para siempre: no había ruta que recordar. Ahora el día vive
 * siempre en "/dia", que es lo que se puede anotar.
 */
function RootRedirect() {
  const saved = getSavedView();
  const porVista = saved === "semana" ? "/semana" : saved === "mes" ? "/mes" : "/dia";
  return <Navigate to={destinoDeArranque(rutaGuardada(CLAVE_DE_RUTA), porVista)} replace />;
}

/** Las rutas, anotando la pantalla actual a medida que cambia. */
function Rutas() {
  useRecordarRuta(CLAVE_DE_RUTA);
  return (
    <Routes>
      <Route path="/"        element={<RootRedirect />} />
      <Route path="/dia"     element={<DayViewPage />} />
      <Route path="/semana"  element={<WeekViewPage />} />
      <Route path="/mes"     element={<MonthViewPage />} />
    </Routes>
  );
}

/**
 * En modo embebido espera el token del host antes de montar las rutas
 * (así ninguna query dispara sin auth). En standalone renderiza directo.
 */
function EmbedGate({ children }: { children: ReactNode }) {
  const ready = useEmbedToken();
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-soft text-sm">
        Cargando agenda…
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const shell = (
    <AppShell embedded={isEmbedded}>
      <Rutas />
    </AppShell>
  );

  return (
    <BrowserRouter>
      {isEmbedded ? <EmbedGate>{shell}</EmbedGate> : shell}
    </BrowserRouter>
  );
}
