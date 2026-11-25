import { describe, expect, it } from "vitest";
import { formatMinutes } from "../format";
import { decadeName } from "../taste";

describe("textos curtos", () => {
  it("duração como na tela", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(150)).toBe("2h30");
    expect(formatMinutes(95)).toBe("1h35");
  });

  it("nome da década", () => {
    expect(decadeName(1990)).toBe("anos 90");
    expect(decadeName(2010)).toBe("anos 2010");
  });
});
