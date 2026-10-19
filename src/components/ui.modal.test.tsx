import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Modal } from "./ui";

const panelDe = (titulo: string) => screen.getByRole("heading", { name: titulo }).parentElement!.parentElement!;

describe("Modal — alto", () => {
  it("por defecto crece con el contenido hasta el 90% de la pantalla", () => {
    render(<Modal open onClose={() => {}} title="Algo">contenido</Modal>);
    expect(panelDe("Algo")).toHaveClass("max-h-[90vh]");
    expect(panelDe("Algo")).not.toHaveClass("h-[90vh]");
  });

  it("con altoFijo ocupa siempre el 90%, tenga lo que tenga adentro", () => {
    render(<Modal open onClose={() => {}} title="Algo" altoFijo>contenido</Modal>);
    expect(panelDe("Algo")).toHaveClass("h-[90vh]");
  });
});
