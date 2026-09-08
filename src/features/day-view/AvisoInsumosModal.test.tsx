import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvisoInsumosModal } from "./AvisoInsumosModal";
import type { Consumo } from "../../api/types";

const faltante = {
  productId: "g",
  name: "Guantes de nitrilo",
  quantity: 2,
  stockAntes: 1,
  stockDespues: -1,
};

const consumo: Consumo = { descontados: 2, faltantes: [faltante], omitidos: [] };

describe("AvisoInsumosModal", () => {
  it("sin consumo no muestra nada", () => {
    const { container } = render(<AvisoInsumosModal consumo={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("nombra el insumo y dice cuánto quedó", () => {
    render(<AvisoInsumosModal consumo={consumo} onClose={() => {}} />);
    expect(screen.getByText("Guantes de nitrilo")).toBeInTheDocument();
    expect(screen.getByText(/quedó en -1, tenía 1 y se usaron 2/)).toBeInTheDocument();
  });

  it("deja claro que el turno YA se completó", () => {
    // Si pareciera una pregunta, quien lo lee buscaría un botón de cancelar que
    // no existe: el descuento ya se hizo y el turno ya está completado.
    render(<AvisoInsumosModal consumo={consumo} onClose={() => {}} />);
    expect(screen.getByText(/se completó y los insumos se descontaron igual/i)).toBeInTheDocument();
  });

  it("con varios faltantes los lista a todos", () => {
    const dos: Consumo = {
      ...consumo,
      faltantes: [faltante, { ...faltante, productId: "a", name: "Ampolla" }],
    };
    render(<AvisoInsumosModal consumo={dos} onClose={() => {}} />);
    expect(screen.getByText("Guantes de nitrilo")).toBeInTheDocument();
    expect(screen.getByText("Ampolla")).toBeInTheDocument();
  });

  it("menciona los archivados sólo si el modal ya está abierto", () => {
    const conArchivado: Consumo = {
      ...consumo,
      omitidos: [{ productId: "a", name: "Ampolla vitamina C", motivo: "archivado" }],
    };
    render(<AvisoInsumosModal consumo={conArchivado} onClose={() => {}} />);
    expect(screen.getByText(/Ampolla vitamina C está en la receta pero archivado/)).toBeInTheDocument();
  });

  it("sin archivados no habla de recetas", () => {
    render(<AvisoInsumosModal consumo={consumo} onClose={() => {}} />);
    expect(screen.queryByText(/archivado/)).not.toBeInTheDocument();
  });

  it("dice dónde se arregla", () => {
    // Sin esto el aviso informa un problema y deja a quien lo lee sin saber qué
    // hacer con él.
    render(<AvisoInsumosModal consumo={consumo} onClose={() => {}} />);
    expect(screen.getByText(/cargando el stock en Insumos/)).toBeInTheDocument();
  });

  it("se cierra con Entendido", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AvisoInsumosModal consumo={consumo} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /entendido/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
