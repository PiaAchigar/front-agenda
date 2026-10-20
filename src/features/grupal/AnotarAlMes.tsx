import { useState } from "react";
import { useAnotarAlMes, useOpcionesParaAnotar, type AnotarAlMesResultado, type OpcionesParaAnotar } from "../../api/grupal";
import { Button, ErrorNote } from "../../components/ui";
import { mesesParaAnotar } from "../../lib/meses-para-anotar";
import { pesos } from "../../lib/vender";
import { mesEnLetras } from "./CobrarCuota";

const TZ = "America/Argentina/Buenos_Aires";

/** ISO UTC → "lun 17/11 10:00" en hora de Argentina. */
export function fechaCorta(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${String(p.weekday).replace(".", "")} ${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** "1 clase" / "N clases". */
export function clases(n: number): string {
  return `${n} ${n === 1 ? "clase" : "clases"}`;
}

/** Anotar a una clienta al mes: elegir horarios y cuota, y anotar (con o sin cobro inmediato). */
export function AnotarAlMes({
  activityId,
  customerId,
  fechaDeLaClase,
  scheduleIdDeLaClase,
  onAnotada,
}: {
  activityId: string;
  customerId: string;
  /** YYYY-MM-DD */
  fechaDeLaClase: string;
  scheduleIdDeLaClase: string | null;
  onAnotada: (r: AnotarAlMesResultado, mes: string, cobrar: boolean) => void;
}) {
  const meses = mesesParaAnotar(fechaDeLaClase);
  const [mes, setMes] = useState(meses[0]);
  const opciones = useOpcionesParaAnotar(activityId, customerId, mes);

  return (
    <div className="space-y-3">
      {meses.length > 1 && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Mes</span>
          <select
            aria-label="Mes"
            className="w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          >
            {meses.map((m) => (
              <option key={m} value={m}>{mesEnLetras(m)} {m.slice(0, 4)}</option>
            ))}
          </select>
        </label>
      )}
      {opciones.error && <ErrorNote message={(opciones.error as Error).message} />}
      {!opciones.data && !opciones.error && <p className="text-sm text-ink-soft">Cargando horarios…</p>}
      {opciones.data && (
        <Formulario
          key={mes}
          opciones={opciones.data}
          activityId={activityId}
          customerId={customerId}
          mes={mes}
          scheduleIdDeLaClase={scheduleIdDeLaClase}
          onAnotada={onAnotada}
        />
      )}
    </div>
  );
}

function Formulario({
  opciones, activityId, customerId, mes, scheduleIdDeLaClase, onAnotada,
}: {
  opciones: OpcionesParaAnotar; activityId: string; customerId: string; mes: string;
  scheduleIdDeLaClase: string | null;
  onAnotada: (r: AnotarAlMesResultado, mes: string, cobrar: boolean) => void;
}) {
  const anotar = useAnotarAlMes();
  const [tildados, setTildados] = useState<string[]>(
    scheduleIdDeLaClase && opciones.horarios.some((h) => h.scheduleId === scheduleIdDeLaClase) ? [scheduleIdDeLaClase] : [],
  );
  const [cuota, setCuota] = useState(opciones.cuotaSugerida);
  const total = opciones.horarios.filter((h) => tildados.includes(h.scheduleId)).reduce((s, h) => s + h.clases, 0);
  const supera = opciones.clasesDelPlan != null && total > opciones.clasesDelPlan;
  const sinHorarios = tildados.length === 0;

  const enviar = (cobrar: boolean) =>
    anotar.mutate(
      { activityId, customerId, mes, scheduleIds: tildados, cuota },
      { onSuccess: (r) => onAnotada(r, mes, cobrar) },
    );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {opciones.horarios.map((h) => (
          <label key={h.scheduleId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tildados.includes(h.scheduleId)}
              onChange={(e) =>
                setTildados((t) => (e.target.checked ? [...t, h.scheduleId] : t.filter((x) => x !== h.scheduleId)))
              }
            />
            <span>
              {h.etiqueta}
              {h.maquina ? ` · ${h.maquina}` : ""} ({clases(h.clases)})
            </span>
          </label>
        ))}
      </div>

      <p className="text-sm font-medium text-ink">{clases(total)} en {mesEnLetras(mes)}</p>
      {supera && <p className="text-xs text-amber-700">Supera las {opciones.clasesDelPlan} clases del plan</p>}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Cuota</span>
        <input
          type="number"
          aria-label="Cuota"
          className="w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          value={cuota}
          onChange={(e) => setCuota(Number(e.target.value) || 0)}
        />
        <span className="mt-1 block text-xs text-ink-soft">Sugerida: {pesos(opciones.cuotaSugerida)}</span>
      </label>

      {anotar.error && <ErrorNote message={(anotar.error as Error).message} />}

      <div className="flex justify-end gap-2 border-t border-surface-high pt-3">
        <Button type="button" variant="secondary" disabled={sinHorarios || anotar.isPending} onClick={() => enviar(false)}>
          Anotar, cobro después
        </Button>
        <Button type="button" disabled={sinHorarios || anotar.isPending} onClick={() => enviar(true)}>
          Anotar y cobrar
        </Button>
      </div>
    </div>
  );
}
