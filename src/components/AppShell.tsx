import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function AppShell({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-sm transition-colors ${
      isActive ? "bg-primary text-white" : "text-ink-soft hover:bg-surface-high"
    }`;

  // Embebida en el dashboard: sin header propio ni max-width, ocupa todo el iframe.
  // Flex-col + altura dinámica (100dvh) para que el contenido llene la pantalla
  // sin huecos en blanco, también en mobile (B4).
  if (embedded) {
    return <main className="flex h-[100dvh] flex-col px-4 py-3">{children}</main>;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="shrink-0 border-b border-surface-high bg-surface-low/90 backdrop-blur">
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
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl min-h-0 flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
