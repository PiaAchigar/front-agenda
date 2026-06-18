import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BookingPage } from "./features/booking/BookingPage";
import { DayViewPage } from "./features/day-view/DayViewPage";
import { WeekViewPage } from "./features/week-view/WeekViewPage";
import { getSavedView } from "./components/ViewTabs";

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

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"        element={<RootRedirect />} />
          <Route path="/dia"     element={<DayViewPage />} />
          <Route path="/semana"  element={<WeekViewPage />} />
          <Route path="/mes"     element={<ComingSoon label="mes" />} />
          <Route path="/reservar" element={<BookingPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
