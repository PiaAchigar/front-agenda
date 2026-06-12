import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function AppShell({ children }: { children: ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-sm transition-colors ${
      isActive ? "bg-primary text-white" : "text-ink-soft hover:bg-surface-high"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-high bg-surface-low/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-3xl font-semibold leading-none text-primary">PiuBella</h1>
            <p className="text-[11px] tracking-[0.25em] text-ink-soft uppercase">
              cuerpo, mente y alma
            </p>
          </div>
          <nav className="flex gap-2">
            <NavLink to="/" className={linkClass} end>
              Turnos del día
            </NavLink>
            <NavLink to="/reservar" className={linkClass}>
              Reservar turno
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
