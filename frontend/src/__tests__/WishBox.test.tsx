import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import WishBox from "../components/WishBox";
import type { Wish } from "../types";

const LEVE: Wish = {
  type: "movie",
  mood: "leve",
  max_minutes: null,
  occasion: "familia",
  discovery: null,
  only_mine: false,
  understood: [
    { text: "leve", labels: ["Leve"] },
    { text: "Sessão da Tarde", labels: ["Em família", "Filmes"] },
  ],
  ignored: ["terror: o pedido só escolhe climas, não tira"],
};
const NADA: Wish = { ...LEVE, type: null, mood: null, occasion: null, understood: [], ignored: [] };

afterEach(cleanup);

function ask(text: string) {
  fireEvent.change(screen.getByLabelText("Peça do seu jeito:"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Pedir" }));
}

describe("Peça do seu jeito (RFF25)", () => {
  it("aplica os filtros e mostra o que cada trecho virou", async () => {
    const understand = vi.spyOn(api, "understand").mockResolvedValue(LEVE);
    const onWish = vi.fn();
    render(<WishBox onWish={onWish} />);
    ask("algo leve para a Sessão da Tarde, sem terror");

    await waitFor(() => expect(onWish).toHaveBeenCalledWith(LEVE));
    expect(understand).toHaveBeenCalledWith("algo leve para a Sessão da Tarde, sem terror");
    expect(screen.getByText(/Entendi/).textContent).toContain("“Sessão da Tarde” virou Em família, Filmes");
    expect(screen.getByText(/Ficou de fora/).textContent).toContain("o pedido só escolhe climas");
  });

  it("não mexe nos filtros quando não entende, e dá exemplos", async () => {
    vi.spyOn(api, "understand").mockResolvedValue(NADA);
    const onWish = vi.fn();
    render(<WishBox onWish={onWish} />);
    ask("qualquer coisa");

    await screen.findByText(/Não entendi esse pedido/);
    expect(onWish).not.toHaveBeenCalled();
  });

  it("limpar o pedido volta os filtros ao padrão", async () => {
    vi.spyOn(api, "understand").mockResolvedValue(LEVE);
    const onWish = vi.fn();
    render(<WishBox onWish={onWish} />);
    ask("algo leve");
    fireEvent.click(await screen.findByRole("button", { name: "Limpar o pedido" }));

    expect(onWish).toHaveBeenLastCalledWith(null);
    expect((screen.getByLabelText("Peça do seu jeito:") as HTMLInputElement).value).toBe("");
  });

  it("não pede nada com o campo vazio", () => {
    render(<WishBox onWish={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Pedir" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
