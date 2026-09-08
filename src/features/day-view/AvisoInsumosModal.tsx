import type { Consumo } from "../../api/types";
import { Button, Modal } from "../../components/ui";
import { descripcionDeFaltante } from "../../lib/aviso-insumos";

/**
 * Avisa que al completar el turno algún insumo quedó en negativo.
 *
 * El turno YA se completó: esto no pregunta nada ni se puede cancelar. Frenar
 * un turno ya hecho por un dato de inventario mal cargado le frena la caja al
 * local (decisión de Laura, 2026-09-08), así que el descuento se hace igual y
 * esto sólo lo cuenta.
 */
export function AvisoInsumosModal({
  consumo,
  onClose,
}: {
  consumo: Consumo | null;
  onClose: () => void;
}) {
  if (!consumo) return null;
  const archivados = consumo.omitidos.filter((o) => o.motivo === "archivado");

  return (
    <Modal open onClose={onClose} title="Faltó stock de insumos">
      <div className="space-y-4">
        <p className="text-sm text-ink">
          El turno se completó y los insumos se descontaron igual, pero{" "}
          {consumo.faltantes.length === 1 ? "uno quedó" : "algunos quedaron"} en negativo:
        </p>

        <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          {consumo.faltantes.map((f) => (
            <li key={f.productId} className="text-sm">
              <span className="font-medium text-amber-900">{f.name ?? "Insumo"}</span>
              <span className="text-amber-900"> — {descripcionDeFaltante(f)}</span>
            </li>
          ))}
        </ul>

        {archivados.length > 0 && (
          // Se menciona sólo si el modal ya está abierto: por sí solo no vale
          // interrumpir a nadie, pero si está a la vista conviene que se sepa.
          <p className="text-xs text-ink-soft">
            Además, {archivados.map((o) => o.name ?? "un insumo").join(", ")} está en la receta
            pero archivado, así que no se descontó.
          </p>
        )}

        <p className="text-xs text-ink-soft">
          El número negativo es el faltante real. Se corrige cargando el stock en Insumos, dentro
          del panel de Administración.
        </p>

        <div className="flex justify-end pt-1">
          <Button onClick={onClose}>Entendido</Button>
        </div>
      </div>
    </Modal>
  );
}
