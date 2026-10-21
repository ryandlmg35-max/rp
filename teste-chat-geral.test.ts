import { describe, expect, it } from "vitest";
import { estadoInicial } from "./src/rp/estadoInicial";
import { useRP } from "./src/rp/store";
import {
  aplicarImpacto,
  impactoConversa,
  repercussaoChat,
  respostaLocalGeral,
} from "./src/rp/canal";

describe("chat geral — motor de impacto", () => {
  it("fala neutra não move nada", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "bom dia, Axiom");
    expect(imp.peso).toBe(0);
    expect(imp.chips).toHaveLength(0);
  });

  it("caridade sobe aprovação e derruba tensão", () => {
    const st = estadoInicial();
    const imp = impactoConversa(
      st,
      "vamos doar 200 milhões pro Renascer, aprovação do povo importa",
    );
    expect(imp.aprovacao).toBe(2);
    expect(imp.tensao).toBe(-1);
    expect(imp.peso).toBeGreaterThanOrEqual(3);
  });

  it("ameaça e esquema ilegal esquentam o império", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "vou destruir a concorrência com um esquema ilegal");
    expect(imp.heat).toBeGreaterThanOrEqual(3);
    expect(imp.aprovacao).toBeLessThan(0);
  });

  it("gastar dinheiro estressa a Sofia", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "quero gastar 800 milhões numa compra nova");
    expect(imp.sofiaEstresse).toBeGreaterThan(0);
  });

  it("parabéns pra CEO citado melhora relação", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "parabéns Priya Anand, mandaram bem nos data centers");
    expect(imp.relacoes["Priya Anand"]).toBe(2);
  });

  it("aplicarImpacto respeita clamp e não vaza caixa", () => {
    const st = estadoInicial();
    st.heat = 99;
    const imp = impactoConversa(st, "vou destruir todos com suborno");
    const pos = aplicarImpacto(st, imp);
    expect(pos.heat).toBeLessThanOrEqual(100);
    expect(pos.caixa).toBe(st.caixa);
    expect(pos.holding).toBe(st.holding);
    expect(pos.mundo.tensao).toBeGreaterThanOrEqual(0);
  });
});

describe("chat geral — repercussão", () => {
  it("falar de gasto ecoa na Sofia", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "vou comprar uma ilha por 2 bilhões");
    const eco = repercussaoChat(st, "vou comprar uma ilha por 2 bilhões", imp);
    expect(eco.some((e) => e.canal === "sofia")).toBe(true);
  });

  it("heat alto ecoa no Axiom", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "vou destruir a Apex, queimar tudo");
    const eco = repercussaoChat(st, "vou destruir a Apex, queimar tudo", imp);
    expect(eco.some((e) => e.canal === "axiom")).toBe(true);
  });

  it("CEO citado com elogio responde no canal dele", () => {
    const st = estadoInicial();
    const imp = impactoConversa(st, "parabéns Daniel Cross pelo trabalho");
    const eco = repercussaoChat(st, "parabéns Daniel Cross pelo trabalho", imp);
    expect(eco.some((e) => e.canal === "media")).toBe(true);
  });
});

describe("chat geral — resposta local", () => {
  it("sempre devolve texto com o estado real", () => {
    const st = estadoInicial();
    const r = respostaLocalGeral(st, "como tá o caixa?");
    expect(r.length).toBeGreaterThan(20);
  });

  it("muda de resposta conforme o assunto", () => {
    const st = estadoInicial();
    const a = respostaLocalGeral(st, "fala do caixa");
    const b = respostaLocalGeral(st, "e o conselho?");
    expect(a).not.toBe(b);
  });
});

describe("ação falarNoGeral no store", () => {
  it("adiciona as duas falas, aplica impacto e não gasta semana", async () => {
    const st = estadoInicial();
    useRP.setState({
      estado: st,
      pensando: false,
      sofiaPensando: false,
      axiomPensando: false,
      geralPensando: false,
    });
    const antesGeral = st.chatGeral.length;
    const antesTurno = st.turno;
    const antesAprov = st.aprovacao;

    await useRP.getState().falarNoGeral("vamos doar pro Renascer e melhorar a aprovação do povo");

    const dep = useRP.getState().estado;
    // Ryan + Axiom (+ eco da Sofia: aprovação +2 puxa repercussão dela)
    expect(dep.chatGeral.length).toBeGreaterThanOrEqual(antesGeral + 2);
    expect(dep.chatGeral[antesGeral].de).toBe("ryan");
    expect(dep.chatGeral[antesGeral + 1].de).toBe("axiom");
    expect(dep.turno).toBe(antesTurno);
    expect(dep.aprovacao).toBeGreaterThan(antesAprov);
  });

  it("fala de gasto gera eco na Sofia com não-lida", async () => {
    const st = estadoInicial();
    useRP.setState({ estado: st, geralPensando: false });
    const antesSofia = st.chatSofia.length;

    await useRP.getState().falarNoGeral("vou gastar 3 bilhões numa compra grande");

    const dep = useRP.getState().estado;
    expect(dep.chatSofia.length).toBeGreaterThan(antesSofia);
    expect(dep.naoLidas.sofia).toBeGreaterThan(0);
    expect(dep.sofia.estresse).toBeGreaterThan(st.sofia.estresse);
  });

  it("fala grande vira entrada de feed", async () => {
    const st = estadoInicial();
    useRP.setState({ estado: st, geralPensando: false });
    const antesFeed = st.feed.length;

    await useRP
      .getState()
      .falarNoGeral("vou destruir a concorrência com um esquema ilegal e queimar tudo");

    const dep = useRP.getState().estado;
    expect(dep.feed.length).toBe(antesFeed + 1);
    expect(dep.feed[0].titulo).toContain("130º");
  });

  it("ignora fala vazia e mês fechado", async () => {
    const st = estadoInicial();
    useRP.setState({ estado: st, geralPensando: false });
    await useRP.getState().falarNoGeral("   ");
    expect(useRP.getState().estado.chatGeral.length).toBe(st.chatGeral.length);

    const fechado = {
      ...estadoInicial(),
      calendario: { ...estadoInicial().calendario, semana: 4 },
    };
    useRP.setState({ estado: fechado, geralPensando: false });
    await useRP.getState().falarNoGeral("teste");
    expect(useRP.getState().estado.chatGeral.length).toBe(fechado.chatGeral.length);
  });
});
