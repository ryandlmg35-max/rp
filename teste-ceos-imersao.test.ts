import { describe, expect, it } from "vitest";
import { estadoInicial } from "./src/rp/estadoInicial";
import { respostaCEO, nivelRelacao } from "./src/rp/ceos";
import { useRP } from "./src/rp/store";

describe("Sistema de CEOs e Tom por Relação", () => {
  it("classifica os níveis de relação corretamente", () => {
    expect(nivelRelacao(90)).toBe("intimo");
    expect(nivelRelacao(75)).toBe("aliado");
    expect(nivelRelacao(55)).toBe("neutro");
    expect(nivelRelacao(35)).toBe("tenso");
    expect(nivelRelacao(20)).toBe("frio");
    expect(nivelRelacao(-10)).toBe("hostil");
  });

  it("gera respostas de Daniel Cross com tom hostil (-35)", () => {
    const estado = estadoInicial();
    const resp = respostaCEO(estado, "media", "como está o orçamento?");
    expect(resp).toBeTruthy();
    expect(typeof resp).toBe("string");
  });

  it("gera respostas de Isabella Mendes com tom íntimo/aliado (+80)", () => {
    const estado = estadoInicial();
    const resp = respostaCEO(estado, "ilha", "como vão as reservas da ilha?");
    expect(resp).toBeTruthy();
    expect(typeof resp).toBe("string");
  });

  it("executa falarComCEO e armazena histórico em chatsCEOs", () => {
    const loja = useRP.getState();
    loja.resetar();

    loja.falarComCEO("tech", "Priya, como estão os data centers?");
    const estadoApos = useRP.getState().estado;

    const chatTech = estadoApos.chatsCEOs["tech"];
    expect(chatTech).toBeDefined();
    expect(chatTech.length).toBe(2); // msg do Ryan + msg da Priya
    expect(chatTech[0].de).toBe("ryan");
    expect(chatTech[0].texto).toContain("data centers");
    expect(chatTech[1].de).toBe("tech");
    expect(chatTech[1].texto.length).toBeGreaterThan(5);
  });
});
