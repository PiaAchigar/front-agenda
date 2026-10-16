// src/features/vender/DespuesDeVender.tsx — provisorio, lo reemplaza Task 8.
import type { Hueco } from "../../lib/que-va-en-el-turno";
import type { TraspasoAAgendar } from "./VenderYAgendar";
export type DespuesDeVenderProps = {
  compraId: string; customerId: string; customerName: string; descripcion: string;
  fecha: string; hueco: Hueco; onAgendar: (t: TraspasoAAgendar) => void; onCerrar: () => void;
};
export function DespuesDeVender(_: DespuesDeVenderProps) { return null; }
