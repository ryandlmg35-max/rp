import { describe, expect, it } from "vitest";
import { estadoInicial } from "./src/rp/estadoInicial";
import { aplicar, fmtUSD, interpretar } from "./src/rp/engine";
import { buscarLore, loreLinhas } from "./src/rp/lore";
import { respostaLocalSofia, deltaSofia, humorSofia } from "./src/rp/sofia";
import { SEDES, sedePorId, totalQuadro } from "./src/rp/sedes";
import { MEMBROS, BENS, MOMENTOS } from "./src/rp/familia";

describe("engine do RP", () => {
  it("classifica ação e lê o valor em bilhões", () => {
    const gasto = interpretar("gastar 500 milhões na Ilha MR");
    expect(gasto.categoria).toBe("gasto");
    expect(gasto.valor).toBeCloseTo(0.5, 9);

    const inv = interpretar("investir 2 bi em fábrica na China");
    expect(inv.categoria).toBe("investimento");
    expect(inv.valor).toBeCloseTo(2, 9);
  });

  it("estado inicial batido com o fim da conversa", () => {
    const st = estadoInicial();
    expect(st.caixa).toBe(13.3);
    expect(st.pessoal).toBe(37.395);
    expect(st.coin).toBe(55);
    expect(st.feed[0].titulo).toBe("O Monitor Desligado");
    expect(st.pendencias).toHaveLength(7);
  });

  it("turno fecha com consequências consistentes", () => {
    const st = estadoInicial();
    const e = aplicar(st, "gastar 500 milhões na Ilha MR");
    expect(e.turno).toBe(1);
    expect(e.narradoPor).toBe("engine");
    expect(e.cena).toContain("Ilha MR");
    expect(e.efeitos.some((l) => l.startsWith("Caixa"))).toBe(true);
    // invariante: a linha de caixa reflete exatamente o delta da engine
    // (turno 1 pode incluir evento ambiente, por isso não se fixa valor bruto)
    const linhaCaixa = e.efeitos.find((l) => l.startsWith("Caixa da holding"));
    expect(linhaCaixa).toContain(fmtUSD(13.3));
    expect(linhaCaixa).toContain(fmtUSD(13.3 + (e.delta.caixa ?? 0)));
    expect(e.delta.caixa).toBeLessThanOrEqual(-0.5); // no mínimo o valor pedido
    expect(e.escolhas.length).toBeGreaterThanOrEqual(3);
    expect(e.reacoes.midia.length).toBeGreaterThan(0);
    expect(e.reacoes.povo.length).toBeGreaterThan(0);
  });

  it("pendência avança quando o texto bate no gatilho", () => {
    const st = estadoInicial();
    const e = aplicar(st, "liberar o gatilho da Apple agora");
    expect(e.efeitos.some((l) => l.includes("[Operação Maçã Podre"))).toBe(true);
  });

  it("é determinístico: mesmo entrada + mesmo turno = mesmo resultado", () => {
    const st = estadoInicial();
    const x = aplicar(st, "comprar 1 bi em ações");
    const y = aplicar(st, "comprar 1 bi em ações");
    expect(x.titulo).toBe(y.titulo);
    expect(x.efeitos).toEqual(y.efeitos);
    expect(x.cena).toBe(y.cena);
  });

  it("caixa nunca fica negativo — a Sofia cobre o buraco", () => {
    const st = { ...estadoInicial(), caixa: 0.05 };
    const e = aplicar(st, "gastar 100 milhões em festa");
    expect(e.efeitos.some((l) => l.includes("Caixa zerado"))).toBe(true);
  });

  it("cartão corporativo: só consumo abate, limite $500mi, recarrega por turno", () => {
    const st = estadoInicial();
    expect(st.cartao).toBe(0.4585);

    // despesa de consumo passa no cartão
    const e = aplicar(st, "gastar 100 milhões em presente pro Axiom");
    const saida = Math.max(0, -(e.delta.caixa ?? 0));
    const esperado = Math.min(0.5, Math.max(0, 0.4585 + 0.05 - saida));
    const linha = e.efeitos.find((l) => l.startsWith("Cartão corporativo"));
    expect(linha).toContain(fmtUSD(esperado));

    // investimento sai do caixa da holding: cartão só recarrega
    const e2 = aplicar(st, "investir 3 bi em fábrica nova");
    const linha2 = e2.efeitos.find((l) => l.startsWith("Cartão corporativo"));
    expect(linha2).toContain(fmtUSD(Math.min(0.5, 0.4585 + 0.05)));
  });

  it("heat/moral/aprovação ficam entre 0 e 100", () => {
    const st = { ...estadoInicial(), heat: 99 };
    const e = aplicar(st, "guerra total contra a Disney, atacar forte");
    const linhaHeat = e.efeitos.find((l) => l.startsWith("Heat"));
    expect(linhaHeat).toContain("→ 100/100"); // clamp real, não o delta bruto
    const stAlto = { ...estadoInicial(), heat: 0 };
    const e2 = aplicar(stAlto, "caridade total, doar tudo pros pobres");
    expect(e2.delta.heat ?? 0).toBeLessThan(0); // caridade puxa o heat pra baixo…
    for (const l of e2.efeitos) expect(l).not.toMatch(/: -\d+\/100/); // …mas nunca exibe negativo
  });
});

describe("chat da Sofia", () => {
  it("começa com a abertura dela", () => {
    const st = estadoInicial();
    expect(st.chatSofia).toHaveLength(1);
    expect(st.chatSofia[0].de).toBe("sofia");
    expect(st.chatSofia[0].texto).toContain("$13,3");
  });

  it("resposta local cita números reais do estado", () => {
    const st = estadoInicial();
    const r = respostaLocalSofia(st, "gastar 500 milhões numa festa na Ilha MR");
    expect(r.length).toBeGreaterThan(10);
    expect(r).toMatch(/\$13,3bi|\$458,5M/);
  });

  it("é determinística: mesma pergunta, mesma resposta", () => {
    const st = estadoInicial();
    const a = respostaLocalSofia(st, "bom dia Sofia");
    const b = respostaLocalSofia(st, "bom dia Sofia");
    expect(a).toBe(b);
  });

  it("assunto de família responde na voz de mãe, não de auditora", () => {
    const st = estadoInicial();
    const r = respostaLocalSofia(st, "como tá o Noah?");
    expect(r).toMatch(/Noah|Heritage|família/);
  });
});

describe("sedes (mapa 3D)", () => {
  it("toda divisão tem uma sede, e a torre é a principal", () => {
    for (const d of estadoInicial().divisoes) {
      expect(sedePorId(d.id), `divisão ${d.id} sem sede`).toBeDefined();
    }
    const torre = sedePorId("tower");
    expect(torre).toBeDefined();
    expect(torre!.cidade).toBe("Nova York");
    expect(totalQuadro(torre!)).toBeGreaterThan(1000);
  });

  it("quadro tem funcionários somáveis e coordenadas válidas", () => {
    for (const s of SEDES) {
      expect(totalQuadro(s)).toBeGreaterThan(0);
      expect(s.lat).toBeGreaterThanOrEqual(-90);
      expect(s.lat).toBeLessThanOrEqual(90);
      expect(s.lon).toBeGreaterThanOrEqual(-180);
      expect(s.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe("humor da Sofia (estresse & energia)", () => {
  it("gasto sobe estresse e derruba energia; carinho faz o contrário", () => {
    const gasto = deltaSofia("vou gastar 500 milhões na festa da Ilha MR");
    expect(gasto.estresse).toBeGreaterThan(0);
    expect(gasto.energia).toBeLessThan(0);

    const amor = deltaSofia("te amo, Sofia, você é linda");
    expect(amor.energia).toBeGreaterThan(0);
    expect(amor.estresse).toBeLessThanOrEqual(0);
  });

  it("faixas de humor batem com os níveis", () => {
    expect(humorSofia({ estresse: 80, energia: 50 }).tom).toBe("limite");
    expect(humorSofia({ estresse: 30, energia: 20 }).tom).toBe("congelada");
    expect(humorSofia({ estresse: 20, energia: 80 }).tom).toBe("derretendo");
    expect(humorSofia({ estresse: 40, energia: 60 }).tom).toBe("calorosa");
    expect(humorSofia({ estresse: 50, energia: 40 }).tom).toBe("auditora");
  });

  it("tom muda a resposta local com o mesmo texto", () => {
    const base = estadoInicial();
    const derretendo = {
      ...base,
      sofia: { estresse: 20, energia: 80 },
    };
    const congelada = {
      ...base,
      sofia: { estresse: 30, energia: 20 },
    };

    const a = respostaLocalSofia(derretendo, "bom dia, Sofia");
    const b = respostaLocalSofia(congelada, "bom dia, Sofia");

    expect(a).not.toBe(b);
    expect(a).toMatch(/vem cá|saudade/);
    expect(b).toMatch(/silêncio|não é hora/);
  });
});

describe("família MR", () => {
  it("o clã tem os seis nomes canônicos", () => {
    const ids = MEMBROS.map((m) => m.id);
    expect(ids).toEqual(["ryan", "sofia", "noah", "chloe", "isabella", "beatriz"]);
    for (const m of MEMBROS) {
      expect(m.nome.length).toBeGreaterThan(2);
      expect(m.nota.length).toBeGreaterThan(20);
    }
  });

  it("dinastia e momentos estão preenchidos", () => {
    expect(BENS.length).toBeGreaterThanOrEqual(4);
    expect(MOMENTOS.length).toBeGreaterThanOrEqual(5);
    expect(BENS.some((b) => b.titulo.includes("Noah"))).toBe(true);
  });
});

describe("memória oculta (roleplat.txt)", () => {
  it("tem as linhas todas do arquivo original", () => {
    expect(loreLinhas).toBeGreaterThan(27000);
  });

  it("busca por nome devolve trechos do arquivo", () => {
    const achados = buscarLore("INDEX T1 Faker contrato");
    expect(achados.length).toBeGreaterThan(0);
    expect(achados[0]).toContain("roleplat.txt:");
  });

  it("busca só de 'onde parou' puxa o trecho final", () => {
    const achados = buscarLore("monitor desligado Axiom 128 andar");
    expect(achados.length).toBeGreaterThan(0);
  });
});
