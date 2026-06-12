import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BookingPage } from "./features/booking/BookingPage";
import { DayViewPage } from "./features/day-view/DayViewPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DayViewPage />} />
          <Route path="/reservar" element={<BookingPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
