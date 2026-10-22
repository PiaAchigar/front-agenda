import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, CircleHelp } from "lucide-react";

/**
 * La ayuda del Nuevo turno (pedido de Pia, 2026-10-22): cómo cargar un turno
 * en sus dos formas —por prestadora o por área / servicio— y lo que hace
 * falta para usar el modal entero. Escrita para la secretaria de Laura.
 */

const VISTA = "ayuda-nuevo-turno-vista";

/** La primera vez en esta computadora: true una sola vez, y queda anotado. */
function usePrimeraVez(): boolean {
  const [primera] = useState(() => {
    try {
      return !localStorage.getItem(VISTA);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!primera) return;
    try {
      localStorage.setItem(VISTA, "1");
    } catch {
      // Sin almacenamiento: late cada vez, no pasa nada.
    }
  }, [primera]);
  return primera;
}

/** El (?) del título. La primera vez da tres latidos de luz para decir "acá estoy". */
export function BotonAyuda({ abierta, onClick }: { abierta: boolean; onClick: () => void }) {
  const late = usePrimeraVez();
  return (
    <button
      type="button"
      aria-label="Cómo cargar un turno"
      aria-expanded={abierta}
      title="Ayuda"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full p-1.5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        abierta ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface-high hover:text-ink",
        late ? "ayuda-latido" : "",
      ].join(" ")}
    >
      <CircleHelp size={20} aria-hidden />
    </button>
  );
}

/** Ocupa el lugar del formulario; el formulario sigue cargado detrás. */
export function AyudaNuevoTurno({ onVolver }: { onVolver: () => void }) {
  const arriba = useRef<HTMLDivElement>(null);
  // El cuerpo del modal puede venir scrolleado desde el formulario.
  useEffect(() => arriba.current?.scrollIntoView({ block: "start" }), []);

  return (
    <div ref={arriba} className="space-y-4 text-sm text-ink">
      <BotonVolver onClick={onVolver} />

      <section className="space-y-2">
        <h4 className="text-base font-semibold">Dos formas de empezar</h4>
        <Forma titulo="Por prestadora" cuando="Ya sabés quién lo hace.">
          <li>Tocá un hueco libre en la columna de ella, o elegila en <b>Prestadora</b>.</li>
          <li><b>Área</b> y <b>Qué</b> muestran sólo lo que ella hace.</li>
          <li>Elegí la clienta y qué se hace.</li>
        </Forma>
        <Forma titulo="Por área o servicio" cuando="Ya sabés qué quiere la clienta.">
          <li>Tocá cualquier hueco libre a esa hora y pasá <b>Prestadora</b> a “Todas”.</li>
          <li>
            Elegí el <b>Área</b>: Prestadora pasa a decir “Todas (3 en Estética)” y lista sólo las que hacen
            algo ahí.
          </li>
          <li>Elegí <b>Qué</b>: quedan sólo las que lo hacen. Si es una sola, queda elegida.</li>
          <li>Elegí la prestadora.</li>
        </Forma>
        <p className="text-xs font-semibold text-primary-dark">
          Para cambiar de forma, volvé Prestadora a “Todas” o vaciá Qué.
        </p>
      </section>

      <Tema titulo="¿Cuándo se cobra?">
        <p><b>Ahora</b>: se vende y se cobra en el momento. Después agendás la primera sesión, o queda “A agendar” en la ficha de la clienta.</p>
        <p><b>En el turno</b>: un servicio se agenda y se cobra cuando viene. Un combo o un pack se vende igual, con el cobro pendiente.</p>
      </Tema>

      <Tema titulo="Si ya tiene sesiones sin usar">
        <p>
          Aparece un aviso amarillo: “Ya tiene este … con N sesiones sin usar”. Tocá una para agendar esa
          sesión, en vez de venderle otra vez. Lo que ya compró también está en Qué, en “Ya comprado”.
        </p>
      </Tema>

      <Tema titulo="Combos, packs y promos: quién lo hace">
        <p>Prestadora las separa en dos grupos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Hacen todo</b>: hacen todos los servicios del combo.</li>
          <li><b>Hacen una parte</b>: al lado dice qué hace cada una, como “Gabi — sólo Limpieza facial”.</li>
        </ul>
        <p>
          La que elijas hace el primer turno. Lo que ella no hace queda “A agendar” y se agenda después
          con otra.
        </p>
      </Tema>

      <Tema titulo="Libre u ocupada a esa hora">
        <p>
          Al agendar, Prestadora separa “Libres a las 15:30” y “Ocupadas”. Una ocupada dice cuándo se libera
          (“libre desde 16:30”) o “sin lugar ese día”. Podés elegirla igual y cambiar la hora abajo.
        </p>
      </Tema>

      <Tema titulo="Confirmar, reservar y seña">
        <p><b>Turno confirmado</b>: queda firme. <b>Reserva temporal</b>: guarda el lugar el tiempo que elijas, y si nadie la confirma se cancela sola.</p>
        <p>En depilación son <b>Agendar</b> y <b>Reservar 24 h</b>. Para Agendar tiene que estar cobrado lo que pide el pack; si falta, se cobra ahí mismo.</p>
        <p><b>Seña</b> (opcional): se factura y queda a favor de la clienta. Si ya tiene saldo a favor, la seña puede salir de ahí.</p>
      </Tema>

      <Tema titulo="Depilación, actividades y capacitaciones">
        <p><b>Depilación</b> se vende en packs, combos y promos. Zonas sueltas no se venden.</p>
        <p>
          <b>Actividades y capacitaciones</b> no se agendan acá, se anotan en Turnos grupales. Desde la columna
          de una prestadora que las dicta aparecen en Área, con el botón “Anotar en grupales”.
        </p>
      </Tema>

      <Tema titulo="Si algo no aparece">
        <p>
          <b>Falta una prestadora</b>: no tiene habilitado ese servicio. Se habilita en Administración →
          Proveedoras. En depilación, en Depilación → Configuración → Comisión.
        </p>
        <p><b>Clienta nueva</b>: en Cliente, escribí su nombre y tocá “+ Crear cliente nuevo”.</p>
        <p><b>Aviso en rojo de horario</b>: el día y la hora ya pasaron. Revisá la fecha.</p>
      </Tema>

      <BotonVolver onClick={onVolver} />
    </div>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-primary-dark transition-colors hover:bg-surface-high focus-visible:outline-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={16} aria-hidden />
      Volver al turno
    </button>
  );
}

function Forma({ titulo, cuando, children }: { titulo: string; cuando: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-highest bg-white p-3">
      <h5 className="font-semibold text-primary-dark">
        {titulo} <span className="font-normal text-ink-soft">· {cuando}</span>
      </h5>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">{children}</ol>
    </div>
  );
}

/** Lo que no hace falta leer de entrada: cerrado, se abre al tocarlo. */
function Tema({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-surface-highest bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium marker:hidden">
        <span className="mr-1.5 inline-block text-ink-soft transition-transform group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}
