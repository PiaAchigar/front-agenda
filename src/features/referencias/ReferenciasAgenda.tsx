import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { FONDO_DEL_HUECO, type TipoDeHueco } from "../../lib/fondo-del-hueco";
import { STATUS_BORDER_COLOR } from "../../lib/colors";

/**
 * "Referencias": qué significa cada fondo y cada color de la grilla.
 *
 * Es un desplegable anclado al botón, no un modal: Laura lo abre para mirar
 * la grilla de al lado, así que no debe taparla ni robarle el foco. Se cierra
 * con Esc (y el foco vuelve al botón) o con un clic afuera.
 *
 * Las muestras de horario salen de `FONDO_DEL_HUECO`, el mismo objeto que
 * pinta la grilla: la ayuda no puede quedar desactualizada.
 */

const HORARIOS: { tipo: TipoDeHueco; nombre: string; texto: string }[] = [
  { tipo: "libre",      nombre: "Libre",         texto: "Tocá el hueco para dar un turno." },
  { tipo: "pasado",     nombre: "Ya pasó",       texto: "Ese horario ya pasó: no se puede agendar." },
  { tipo: "no-atiende", nombre: "No atiende",    texto: "Fuera del horario de esa prestadora." },
  { tipo: "cerrado",    nombre: "Local cerrado", texto: "Fuera del horario del local." },
];

const ESTADOS: { estado: keyof typeof STATUS_BORDER_COLOR; nombre: string; texto: string }[] = [
  { estado: "scheduled", nombre: "Agendado",   texto: "Turno confirmado, todavía no vino." },
  { estado: "completed", nombre: "Completado", texto: "Ya se atendió." },
  { estado: "no_show",   nombre: "Ausente",    texto: "No vino al turno." },
];

export function ReferenciasAgenda() {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!abierto) return;
    function alTocarAfuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function alApretarTecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    }
    document.addEventListener("pointerdown", alTocarAfuera);
    document.addEventListener("keydown", alApretarTecla);
    return () => {
      document.removeEventListener("pointerdown", alTocarAfuera);
      document.removeEventListener("keydown", alApretarTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        aria-label="Referencias de colores"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((a) => !a)}
        className={[
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          abierto
            ? "border-primary-container bg-surface-low text-primary"
            : "border-surface-highest bg-white text-ink-soft hover:bg-surface-low hover:text-ink",
        ].join(" ")}
      >
        <Info size={16} aria-hidden />
        <span className="hidden xl:inline">Referencias</span>
      </button>

      {abierto && (
        <div
          id={panelId}
          role="region"
          aria-label="Referencias de colores"
          className="referencias-panel z-40 rounded-xl max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:max-h-[calc(100vh-5rem)] max-sm:overflow-y-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] border border-surface-high bg-white p-4 shadow-[0_10px_28px_-8px_rgba(61,52,44,0.28)]"
        >
          <Grupo titulo="Horarios">
            {HORARIOS.map((h) => (
              <Item key={h.tipo} nombre={h.nombre} texto={h.texto} muestra={<MuestraDeHueco tipo={h.tipo} />} />
            ))}
          </Grupo>

          <div className="my-3 border-t border-surface-high" />

          <Grupo titulo="Turnos">
            <Item
              nombre="Color de la tarjeta"
              texto="Cada prestadora tiene el suyo."
              muestra={
                <span className="flex h-6 w-10 overflow-hidden rounded-md border border-surface-high">
                  <span className="flex-1" style={{ background: "#fce7f3" }} />
                  <span className="flex-1" style={{ background: "#dbeafe" }} />
                  <span className="flex-1" style={{ background: "#dcfce7" }} />
                </span>
              }
            />
            {ESTADOS.map((e) => (
              <Item
                key={e.estado}
                nombre={e.nombre}
                texto={e.texto}
                muestra={<MuestraDeTarjeta borde={STATUS_BORDER_COLOR[e.estado]!} />}
              />
            ))}
            <Item
              nombre="Reserva"
              texto="Apartado sin confirmar: se cancela solo si vence. El reloj se pone rojo cuando faltan 10 minutos o menos."
              muestra={
                <span
                  className="flex h-6 w-10 items-center justify-center rounded-md border border-dashed border-amber-400 text-[11px]"
                  style={{ background: "#fffbeb", borderLeft: `4px solid ${STATUS_BORDER_COLOR.reserved}` }}
                >
                  ⏳
                </span>
              }
            />
            <Item
              nombre="Debe $X"
              texto="Falta cobrar algo de la compra de ese turno (de toda la compra, no sólo de ese turno). Se cobra desde el detalle."
              muestra={<span className="flex h-6 w-10 items-center justify-center rounded-md border border-surface-high bg-white text-[10px] font-semibold text-red-700">Debe</span>}
            />
          </Grupo>
        </div>
      )}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo}>
      {/* Un <p> y no un <h3>: los títulos globales usan la letra de display,
          que a este tamaño se lee como un error. */}
      <p className="mb-2 text-xs font-semibold text-ink-soft">{titulo}</p>
      <ul className="space-y-2.5">{children}</ul>
    </section>
  );
}

function Item({ nombre, texto, muestra }: { nombre: string; texto: string; muestra: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0" aria-hidden>{muestra}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight text-ink">{nombre}</span>
        <span className="block text-xs leading-snug text-ink-soft">{texto}</span>
      </span>
    </li>
  );
}

function MuestraDeHueco({ tipo }: { tipo: TipoDeHueco }) {
  const fondo = FONDO_DEL_HUECO[tipo];
  return (
    <span
      data-hueco={tipo}
      className={`flex h-6 w-10 items-center justify-center rounded-md border border-surface-high ${fondo.className}`}
      style={fondo.style}
    >
      {tipo === "libre" && <span className="text-sm font-light leading-none text-gray-300">+</span>}
    </span>
  );
}

function MuestraDeTarjeta({ borde }: { borde: string }) {
  return (
    <span
      className="block h-6 w-10 rounded-md border border-surface-high"
      style={{ background: "#f5efe7", borderLeft: `4px solid ${borde}` }}
    />
  );
}
