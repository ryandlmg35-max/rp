import { describe, expect, it } from "vitest";
import { estadoInicial } from "./src/rp/estadoInicial";
import {
  chaveMes,
  formatarCalendario,
  intervaloDaSemana,
  mesFechado,
  proximaSemana,
  proximoMes,
} from "./src/rp/calendario";
import {
  DIRETRIZES,
  avancarSemanaComEventos,
  avancarSemanaLocal,
  ceosAtivos,
  eventosLocais,
  fecharMesLocal,
  parseMoeda,
  recadoLocal,
  reuniaoLocal,
  resumoMensal,
  validarEventosIA,
  validarReuniaoIA,
  type EventoMundo,
} from "./src/rp/mundo";
import { BASE_NVIDIA, configInicial, extrairJSON, limitar } from "./src/rp/ia";
import { respostaLocalAxiom } from "./src/rp/axiom";
import { fmtUSD } from "./src/rp/engine";

describe("calendário do império", () => {
  it("anda semana a semana e trava na semana 4", () => {
    let c = { ano: 2027, mes: 1, semana: 1 };
    expect(formatarCalendario(c)).toContain("jan 2027 · semana 1/4");
    c = proximaSemana(c)!;
    expect(c.semana).toBe(2);
    c = proximaSemana(c)!;
    c = proximaSemana(c)!;
    expect(c.semana).toBe(4);
    expect(mesFechado(c)).toBe(true);
    expect(proximaSemana(c)).toBeNull();
  });

  it("vira o mês e o ano", () => {
    expect(proximoMes({ ano: 2026, mes: 12, semana: 4 })).toEqual({
      ano: 2027,
      mes: 1,
      semana: 1,
    });
    expect(proximoMes({ ano: 2027, mes: 5, semana: 4 })).toEqual({
      ano: 2027,
      mes: 6,
      semana: 1,
    });
    expect(chaveMes({ ano: 2027, mes: 2, semana: 1 })).toBe("2027-02");
  });

  it("formata o intervalo da semana sem quebrar na virada", () => {
    const s1 = intervaloDaSemana({ ano: 2027, mes: 1, semana: 1 });
    expect(s1).toContain("jan 2027");
    const s4 = intervaloDaSemana({ ano: 2027, mes: 1, semana: 4 });
    expect(s4).toContain("25–31");
  });
});

describe("números do mundo", () => {
  it("lê moeda do RP em todas as formas do arquivo", () => {
    expect(parseMoeda("$21,8bi")).toBeCloseTo(21.8, 6);
    expect(parseMoeda("$420mi")).toBeCloseTo(0.42, 6);
    expect(parseMoeda("-$68,5mi")).toBeCloseTo(-0.0685, 6);
    expect(parseMoeda("$500mi proj.")).toBeCloseTo(0.5, 6);
    expect(parseMoeda("$20mi+ (reservas)")).toBeCloseTo(0.02, 6);
    expect(parseMoeda("$350mi/dia")).toBeCloseTo(10.5, 6);
    expect(parseMoeda("$3,2bi (sinais)")).toBe(0);
    expect(parseMoeda("—")).toBe(0);
  });

  it("resumo mensal aplica multiplicador do plano e tensão", () => {
    const st = estadoInicial();
    const base = resumoMensal(st);
    expect(base.receita).toBeGreaterThan(50);
    expect(base.lucro).toBeGreaterThan(15);
    expect(base.porDivisao).toHaveLength(st.divisoes.length);

    const comPlano = resumoMensal({
      ...st,
      plano: { ...st.plano, receitaMult: 1.1, lucroMult: 1.2 },
    });
    expect(comPlano.receita).toBeCloseTo(base.receita * 1.1, 6);
    expect(comPlano.lucro).toBeCloseTo(base.lucro * 1.2, 6);

    const tenso = resumoMensal({
      ...st,
      mundo: { ...st.mundo, tensao: 80 },
    });
    expect(tenso.lucro).toBeCloseTo(base.lucro * 0.92, 6);
  });

  it("eventos locais são determinísticos, 1-2 por semana e limitados", () => {
    const st = estadoInicial();
    const a = eventosLocais(st);
    const b = eventosLocais(st);
    expect(a.map((e) => e.titulo)).toEqual(b.map((e) => e.titulo));
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(2);
    for (const e of a) {
      expect(e.texto.length).toBeGreaterThan(40);
      expect(Math.abs(e.efeitos.holding ?? 0)).toBeLessThanOrEqual(15.2);
      expect(Math.abs(e.efeitos.heat ?? 0)).toBeLessThanOrEqual(12);
      if (e.conflito) {
        expect(ceosAtivos(st).some((c) => c.nome === e.conflito!.entre)).toBe(true);
      }
    }
  });

  it("evento aplicado mexe no estado e avança uma semana", () => {
    const st = estadoInicial();
    const ev: EventoMundo = {
      id: "teste",
      faccao: "governo",
      titulo: "Teste de política",
      texto: "Um teste de evento do mundo com consequência real.",
      efeitos: { caixa: 0.3, holding: -5, heat: 4, relacoes: { Axiom: -3 } },
      fonte: "engine",
    };
    const r = avancarSemanaComEventos(st, [ev]);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.estado.turno).toBe(1);
    expect(r.estado.calendario.semana).toBe(2);
    expect(r.estado.caixa).toBeCloseTo(13.6, 4);
    expect(r.estado.holding).toBeCloseTo(3795, 2);
    expect(r.estado.heat).toBe(59);
    expect(r.estado.relacoes.Axiom).toBe(97);
    expect(r.entrada.efeitos.some((l) => l.startsWith("Caixa"))).toBe(true);
    expect(r.entrada.data).toBe(formatarCalendario(r.estado.calendario));
  });

  it("avança até a semana 4 e para — aí é conselho", () => {
    let st = estadoInicial();
    for (let i = 0; i < 3; i++) {
      const r = avancarSemanaLocal(st);
      expect(r).not.toBeNull();
      if (!r) return;
      st = r.estado;
    }
    expect(st.calendario.semana).toBe(4);
    expect(avancarSemanaLocal(st)).toBeNull();
  });

  it("a IA não move número fora do contrato", () => {
    const st = estadoInicial();
    const bruto = JSON.stringify({
      eventos: [
        {
          faccao: "concorrencia",
          titulo: "Rival agressiva",
          texto: "Uma empresa rival abriu operação no Brasil com preço abaixo do custo.",
          efeitos: {
            caixa: 999,
            holding: -999,
            heat: 50,
            coin: 2,
            relacoes: { "Camila Duarte": -50, Fantasma: -3 },
          },
          conflito: { entre: "Camila Duarte", sobre: "preço", nivel: 99 },
        },
        {
          faccao: "invalida",
          titulo: "Segundo evento",
          texto: "Outro acontecimento material da semana com impacto no conselho.",
          efeitos: { coin: 2 },
        },
      ],
    });
    const evs = validarEventosIA(bruto, st);
    expect(evs).not.toBeNull();
    if (!evs) return;
    expect(evs).toHaveLength(2);
    expect(evs[0].faccao).toBe("concorrencia");
    expect(evs[1].faccao).toBe("concorrencia");
    expect(evs[0].efeitos.caixa).toBeCloseTo(0.4, 6);
    expect(evs[0].efeitos.holding).toBeCloseTo(-15.2, 2);
    expect(evs[0].efeitos.heat).toBe(12);
    expect(evs[0].efeitos.relacoes?.["Camila Duarte"]).toBe(-8);
    expect(evs[0].efeitos.relacoes?.Fantasma).toBeUndefined();
    expect(evs[0].conflito?.nivel).toBe(40);
    expect(evs[1].efeitos.coin).toBe(2);
  });

  it("rejeita JSON quebrado ou vazio", () => {
    const st = estadoInicial();
    expect(validarEventosIA("nada aqui", st)).toBeNull();
    expect(validarEventosIA('{"eventos":[]}', st)).toBeNull();
    expect(validarEventosIA('{"eventos":[{"titulo":"x"}]}', st)).toBeNull();
  });
});

describe("conselho e fechamento", () => {
  it("reunião local tem todos os CEOs e as três diretrizes", () => {
    const st = estadoInicial();
    const r = reuniaoLocal(st);
    expect(r.ceos.length).toBeGreaterThanOrEqual(10);
    expect(r.ceos[0].fala.length).toBeGreaterThan(30);
    expect(r.abertura).toContain(fmtUSD(resumoMensal(st).receita));
    expect(r.sofia.length).toBeGreaterThan(20);
    expect(r.axiom.toLowerCase()).toContain("boss man");
    expect(DIRETRIZES).toHaveLength(3);
  });

  it("valida roteiro da IA mantendo os CEOs reais", () => {
    const st = estadoInicial();
    const base = reuniaoLocal(st);
    const payload = {
      abertura: "Bom dia. O mês fechou.",
      ceos: base.ceos.slice(0, 6).map((c) => ({ nome: c.nome, fala: `Fala de ${c.nome}.` })),
      sofia: "Auditoria fechada.",
      axiom: "Boss man, segue o jogo.",
    };
    const r = validarReuniaoIA(JSON.stringify(payload), st);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.ceos).toHaveLength(base.ceos.length);
    expect(r.ceos[0].fala).toBe(`Fala de ${base.ceos[0].nome}.`);
    expect(validarReuniaoIA('{"abertura":"x"}', st)).toBeNull();
  });

  it("diretriz de caixa paga lucro, dividendo e vira o mês", () => {
    const st = { ...estadoInicial(), calendario: { ano: 2027, mes: 1, semana: 4 } };
    const lucro = resumoMensal(st).lucro;
    const antes = st.caixa;
    const r = fecharMesLocal(st, "caixa", "Bom dia, conselho.");

    expect(r.estado.calendario).toEqual({ ano: 2027, mes: 2, semana: 1 });
    expect(r.estado.turno).toBe(st.turno + 1);
    expect(r.estado.caixa).toBeCloseTo(antes + lucro * 1.12, 3);
    expect(r.estado.pessoal).toBeCloseTo(st.pessoal + lucro * 0.25, 3);
    expect(r.relatorio.dividendos).toBeCloseTo(lucro * 0.25, 6);
    expect(r.relatorio.caixaAntes).toBeCloseTo(antes, 6);
    expect(r.relatorio.diretriz).toBe("Máquina de caixa");
    expect(r.estado.plano.lucroMult).toBe(1.12);
    expect(r.estado.plano.mesRef).toBe("2027-02");
    expect(r.estado.sofia.energia).toBe(51);
    expect(r.estado.ultimoRelatorio?.lucro).toBeCloseTo(lucro, 6);
    expect(r.estado.feed[0].titulo).toContain("Conselho de fechamento");
    expect(r.estado.feed[0].cena).toContain("Bom dia, conselho.");
    expect(r.estado.feed[0].efeitos.some((l) => l.includes("Dividendo"))).toBe(true);
  });

  it("diretriz de expansão investe caixa e aumenta holding", () => {
    const st = { ...estadoInicial(), calendario: { ano: 2027, mes: 1, semana: 4 } };
    const lucro = resumoMensal(st).lucro;
    const r = fecharMesLocal(st, "expansao");
    expect(r.estado.caixa).toBeCloseTo(st.caixa + lucro * 0.7, 3);
    expect(r.estado.holding).toBeCloseTo(st.holding + lucro * 0.5, 2);
    expect(r.estado.moral).toBe(Math.min(100, st.moral + 2));
    expect(r.estado.plano.receitaMult).toBe(1.08);
  });

  it("vira dezembro pra janeiro", () => {
    const st = { ...estadoInicial(), calendario: { ano: 2026, mes: 12, semana: 4 } };
    const r = fecharMesLocal(st, "ia");
    expect(r.estado.calendario).toEqual({ ano: 2027, mes: 1, semana: 1 });
    expect(r.relatorio.ano).toBe(2026);
    expect(r.relatorio.mes).toBe(12);
  });

  it("recado espontâneo cita o último acontecimento", () => {
    const st = estadoInicial();
    const s = recadoLocal(st, "sofia");
    const a = recadoLocal(st, "axiom");
    expect(s).toContain("O Monitor Desligado");
    expect(a).toContain("O Monitor Desligado");
    expect(a.length).toBeGreaterThan(40);
  });
});

describe("Axiom e configuração de IA", () => {
  it("Axiom local responde com números reais do estado", () => {
    const st = estadoInicial();
    const r = respostaLocalAxiom(st, "como tá o caixa?");
    expect(r).toContain(fmtUSD(st.caixa));
    const plano = respostaLocalAxiom(st, "qual o plano do mês?");
    expect(plano).toContain(st.plano.diretriz);
    expect(respostaLocalAxiom(st, "e o conselho?").length).toBeGreaterThan(30);
  });

  it("config inicial liga a NVIDIA com modelos acessíveis", () => {
    const cfg = configInicial();
    expect(cfg.provedor).toBe("nvidia");
    expect(cfg.baseUrl).toBe(BASE_NVIDIA);
    expect(cfg.habilitada).toBe(true);
    expect(cfg.modelos.narrador).toBe("openai/gpt-oss-20b");
    expect(cfg.modelos.mundo).toBe("openai/gpt-oss-20b");
    // Sofia e Axiom usam DeepSeek V4.1 Flash — mais permissivo pra roleplay ficcional
    expect(cfg.modelos.sofia).toBe("deepseek-ai/deepseek-v4.1-flash");
    expect(cfg.modelos.axiom).toBe("deepseek-ai/deepseek-v4.1-flash");
    expect(limitar(999, -5, 5)).toBe(5);
    expect(limitar(-999, -5, 5)).toBe(-5);
  });

  it("extrai JSON embrulhado em prosa", () => {
    const r = extrairJSON<{ ok: boolean }>('claro! {"ok":true} espero ter ajudado');
    expect(r?.ok).toBe(true);
    expect(extrairJSON("sem json")).toBeNull();
  });
});
