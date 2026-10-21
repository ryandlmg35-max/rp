import { describe, expect, it } from "vitest";
import { estadoInicial } from "./src/rp/estadoInicial";
import { useRP } from "./src/rp/store";
import type { ConviteReuniao } from "./src/rp/types";
import {
  CASA_ID,
  decisaoSofiaCasa,
  detectarReuniao,
  distanciaKm,
  formatarDuracao,
  localPorId,
  opcoesViagem,
  resolverLocal,
  veiculosEm,
} from "./src/rp/viagens";

describe("logística da casa e das sedes", () => {
  it("resolve a base, a casa e sedes reais", () => {
    expect(localPorId("tower").tipo).toBe("base");
    expect(localPorId("casa").tipo).toBe("casa");
    expect(localPorId("media").cidade).toBe("Los Angeles");
    expect(localPorId("inexistente").id).toBe("tower");
  });

  it("mede Greenwich a partir de Manhattan", () => {
    const km = distanciaKm(localPorId("tower"), localPorId(CASA_ID));
    expect(km).toBeGreaterThan(30);
    expect(km).toBeLessThan(80);
  });

  it("oferece jato, helicóptero e carro em cada base", () => {
    const base = veiculosEm(localPorId("tower")).map((v) => v.tipo);
    const casa = veiculosEm(localPorId("casa")).map((v) => v.tipo);
    expect(base).toContain("jato");
    expect(base).toContain("helicoptero");
    expect(base).toContain("carro");
    expect(casa).toContain("jato");
    expect(casa).toContain("helicoptero");
  });

  it("recomenda o helicóptero pra Greenwich e o jato pra Los Angeles", () => {
    const casa = opcoesViagem(localPorId("tower"), localPorId("casa"));
    const recomendadoCasa = casa.find((o) => o.recomendado);
    expect(recomendadoCasa?.tipo).toBe("helicoptero");
    expect(recomendadoCasa?.dentro).toBe(true);

    const la = opcoesViagem(localPorId("tower"), localPorId("media"));
    expect(la.find((o) => o.recomendado)?.tipo).toBe("jato");
    expect(la.find((o) => o.tipo === "carro")?.dentro).toBe(false);
  });

  it("formata duração curta e longa", () => {
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(125)).toBe("2h 5min");
    expect(formatarDuracao(1500)).toBe("1d 1h");
  });

  it("mapeia o local citado no texto", () => {
    expect(resolverLocal("reunião em Greenwich", "tower")).toBe("casa");
    expect(resolverLocal("reunião na torre", "casa")).toBe("tower");
    expect(resolverLocal("reunião em Brasília", "tower")).toBe("gov");
    expect(resolverLocal("reunião em Los Angeles", "tower")).toBe("media");
    expect(resolverLocal("reunião sem lugar", "casa")).toBe("casa");
  });
});

describe("detector de reunião no chat", () => {
  it("detecta reunião com conselho e local explícito", () => {
    const st = estadoInicial();
    const c = detectarReuniao("Sofia, marca uma reunião com o conselho amanhã na base", st);
    expect(c).not.toBeNull();
    expect(c?.localId).toBe("tower");
    expect(c?.quando).toBe("Amanhã");
    expect(c?.titulo).toBe("Conselho extraordinário");
    expect(c?.participantes).toContain("Sofia Mendes");
  });

  it("detecta reunião em Greenwich com o Musk", () => {
    const st = estadoInicial();
    const c = detectarReuniao("marca uma reunião com o Musk em Greenwich", st);
    expect(c?.localId).toBe("casa");
    expect(c?.participantes).toContain("Elon Musk");
  });

  it("não transforma pergunta sobre reunião passada em convite", () => {
    const st = estadoInicial();
    expect(detectarReuniao("como foi a reunião de ontem?", st)).toBeNull();
    expect(detectarReuniao("cancelar a reunião com o conselho", st)).toBeNull();
  });

  it("sem ação nem 'com', não inventa reunião", () => {
    const st = estadoInicial();
    expect(detectarReuniao("a reunião do conselho foi longa", st)).toBeNull();
  });
});

describe("Sofia decide se vai pra casa", () => {
  it("aceita com estresse e tensão controlados", () => {
    const st = estadoInicial();
    st.sofia = { estresse: 40, energia: 55 };
    st.mundo.tensao = 38;
    expect(decisaoSofiaCasa(st).aceita).toBe(true);
  });

  it("recusa com estresse alto", () => {
    const st = estadoInicial();
    st.sofia = { estresse: 82, energia: 55 };
    const d = decisaoSofiaCasa(st);
    expect(d.aceita).toBe(false);
    expect(d.linha).toContain("Hoje não");
  });

  it("recusa com conselho em tensão", () => {
    const st = estadoInicial();
    st.mundo.tensao = 74;
    expect(decisaoSofiaCasa(st).aceita).toBe(false);
  });

  it("recusa sem energia", () => {
    const st = estadoInicial();
    st.sofia = { estresse: 30, energia: 10 };
    expect(decisaoSofiaCasa(st).aceita).toBe(false);
  });
});

describe("ações de viagem no store", () => {
  it("sai da base, chega em Greenwich e a Sofia decide", () => {
    const st = estadoInicial();
    useRP.setState({ estado: st, pensando: false, sofiaPensando: false, axiomPensando: false });
    const antes = st.chatSofia.length;
    const ok = useRP.getState().viajarPara("casa", "aw139");
    const depois = useRP.getState().estado;
    expect(ok).toBe(true);
    expect(depois.localizacao).toBe("casa");
    expect(typeof depois.sofiaNaCasa).toBe("boolean");
    expect(depois.chatSofia.length).toBe(antes + 1);
  });

  it("configura a reunião e registra a ata ao encerrar", () => {
    const st = estadoInicial();
    const convite: ConviteReuniao = {
      id: "teste-reuniao",
      titulo: "Reunião de teste",
      localId: "tower",
      origemId: "tower",
      participantes: ["Sofia Mendes", "Axiom"],
      quando: "Hoje",
      criadoTurno: st.turno,
      fonte: "local",
    };
    useRP.setState({ estado: { ...st, convite } });
    expect(useRP.getState().entrarNaReuniao()).toBe(true);
    expect(useRP.getState().estado.reuniaoAtual?.id).toBe(convite.id);
    const antes = useRP.getState().estado.chatAxiom.length;
    useRP.getState().encerrarReuniao();
    const depois = useRP.getState().estado;
    expect(depois.reuniaoAtual).toBeNull();
    expect(depois.chatAxiom.length).toBe(antes + 1);
  });

  it("não aceita veículo que não está na origem", () => {
    const st = estadoInicial();
    useRP.setState({ estado: st });
    expect(useRP.getState().viajarPara("casa", "h145")).toBe(false);
    expect(useRP.getState().estado.localizacao).toBe("tower");
  });
});
