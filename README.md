# SPACE · Império MR — Roleplay

Simulador de roleplay do império Space: você é Ryan Dalbert, Chairman de um holding de $3,8 trilhões, e **cada ação que você escreve fecha consequências reais** — caixa, patrimônio, Space Coin, heat da imprensa, moral do vestiário e aprovação do povo se movem a cada turno, com reações em 3 camadas (mídia / mercado / povo).

O app começa **exatamente de onde a conversa parou**: pós Operação Mãos Limpas, caixa $13,3bi, bolso pessoal $37,395bi, Space Coin $55, Apple na geladeira, obras do Estates congeladas, INDEX indeciso, EWC nas quartas. Todas as 7 pendências abertas vivem na coluna esquerda e avançam de etapa quando você age sobre elas.

## Arquitetura (motor híbrido)

- **Engine determinística** (`src/rp/engine.ts`) — classifica a ação, lê o valor em texto ("gastar 500 milhões"), aplica o plano de efeitos da categoria, rola eventos ambientais com RNG semeado (mesmo turno + mesma ação = mesmo resultado), avança pendências por gatilho e emite as consequências numéricas. Os números **nunca** vêm da IA.
- **IA narradora opcional** (`src/rp/narrador.ts`) — se você ligar em ⚙ Ajustes com uma chave de API compatível com OpenAI, a IA reescreve só o título e a cena no estilo do Axiom. Erro/chave ruim → engine local assume, o turno nunca trava.
- **Memória oculta** (`src/rp/lore.ts`) — o `roleplat.txt` inteiro (27.728 linhas do RP original) vai embutido no bundle, nunca aparece na UI; a cada turno com IA ligada, busca lexical puxa os trechos relevantes como contexto.
- **Persistência** — estado salvo no localStorage a cada turno, com export/import de save e reset nos ajustes.

## Desenvolvimento

```sh
npm i
npm run dev      # http://localhost:8080
npm run build
npx vitest run   # suíte da engine (10 testes)
```

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd0de4bc-4df7-476b-b6cc-6227c6af847b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
