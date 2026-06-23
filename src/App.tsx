import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BookingPage } from "./features/booking/BookingPage";
import { DayViewPage } from "./features/day-view/DayViewPage";
import { WeekViewPage } from "./features/week-view/WeekViewPage";
import { getSavedView } from "./components/ViewTabs";
import { isEmbedded, useEmbedToken } from "./lib/embed";

/** Redirige a la última vista guardada al entrar a la raíz. */
function RootRedirect() {
  const saved = getSavedView();
  if (saved === "semana") return <Navigate to="/semana" replace />;
  if (saved === "mes")    return <Navigate to="/mes"    replace />;
  return <DayViewPage />;
}

/** Placeholder hasta que se implemente la vista. */
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-ink-soft text-sm">
      Vista {label} — próximamente
    </div>
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
      <Routes>
        <Route path="/"        element={<RootRedirect />} />
        <Route path="/dia"     element={<DayViewPage />} />
        <Route path="/semana"  element={<WeekViewPage />} />
        <Route path="/mes"     element={<ComingSoon label="mes" />} />
        <Route path="/reservar" element={<BookingPage />} />
      </Routes>
    </AppShell>
  );

  return (
    <BrowserRouter>
      {isEmbedded ? <EmbedGate>{shell}</EmbedGate> : shell}
    </BrowserRouter>
  );
}
