import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import ArrivalsNote from "../components/ArrivalsNote";
import type { Arrival, Media } from "../types";

const media = (id: number, title: string) => ({ id, title, type: "movie" }) as Media;
const CHEGADAS: Arrival[] = [
  { media: media(1, "Interestelar"), service: { key: "netflix", label: "Netflix", logo: null }, since: "2026-11-24T00:00:00Z" },
  { media: media(2, "Duna"), service: { key: "max", label: "Max", logo: null }, since: "2026-11-20T00:00:00Z" },
];

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const show = () =>
  render(
    <MemoryRouter>
      <ArrivalsNote />
    </MemoryRouter>,
  );

describe("Aviso do Quero ver (RFF29)", () => {
  it("lista o que chegou, com o serviço", async () => {
    vi.spyOn(api, "arrivals").mockResolvedValue(CHEGADAS);
    show();
    expect((await screen.findByRole("link", { name: "Interestelar" })).getAttribute("href")).toBe("/media/1");
    expect(screen.getByText("agora está na Max")).toBeTruthy();
  });

  it("“Entendi” esconde o aviso, também na próxima visita", async () => {
    vi.spyOn(api, "arrivals").mockResolvedValue(CHEGADAS);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Entendi" }));
    expect(screen.queryByText("Interestelar")).toBeNull();

    cleanup();
    show();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("Interestelar")).toBeNull();
  });

  it("sem nada novo, não aparece", async () => {
    vi.spyOn(api, "arrivals").mockResolvedValue([]);
    const { container } = show();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
