# Mello Travasso — Gestão Financeira de Obras

Sistema administrativo web para controle financeiro de obras comerciais:
comprovantes de pagamento, contas a pagar/receber e histórico de custo de
materiais, com pré-preenchimento automático via IA a partir de fotos de
comprovantes e notas fiscais.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript estrito** (sem `any`)
- **Tailwind CSS v4** — identidade visual "navy + dourado" em [src/app/globals.css](src/app/globals.css), componentes base em [src/components/ui](src/components/ui)
- **Recharts** para os gráficos do dashboard (fluxo financeiro, gastos por categoria) e de evolução de preço
- Roteamento: **file-based routing do Next.js** (App Router) — substitui o React Router; cada pasta em `src/app` é uma tela
- Layout responsivo: sidebar fixa em telas ≥768px ([Sidebar.tsx](src/components/layout/Sidebar.tsx)), bottom nav abaixo disso ([BottomNav.tsx](src/components/layout/BottomNav.tsx)) — ver [ShellWrapper.tsx](src/components/layout/ShellWrapper.tsx)
- IA de leitura de imagem: **Anthropic Claude (API de visão + tool use)**, chamada apenas server-side
- Gerenciador de pacotes: **yarn**
- Hospedagem alvo: **Vercel**

Por que Next.js em vez de uma SPA com Vite: as rotas de API (`src/app/api/**`)
rodam no mesmo projeto e mesmo deploy da Vercel, o que resolve de graça o
requisito "manter a chave de IA fora do cliente" sem precisar de um backend
separado — e mantém a porta aberta para trocar por um backend dedicado depois
(a camada `services/` já é agnóstica a isso).

## Arquitetura de pastas

```
src/
  types/            Contratos de dados (Obra, ContaFinanceira, ItemProduto,
                     DadosExtraidosComprovante, ...) — definidos ANTES da UI.
  services/
    ai/              Camada de IA. reciboReader.ts é chamado pela UI;
                      provedor.server.ts e providers/* só rodam no servidor.
    data/            Camada de dados (repositórios). Hoje implementada sobre
                      localStorage (*.local.ts); trocar por HTTP/Prisma no
                      futuro só exige criar uma nova implementação das
                      interfaces em repositorios.ts — UI e hooks não mudam.
    http/            (reservado para o client HTTP quando houver backend)
  hooks/             useObras, useContas, useConta, useItensProduto, useFuncionarios,
                     useFuncionario, useCamera, useIsDesktop
  components/
    ui/              Design system: Button, Card, Input, Select, Textarea,
                      Badge, StatusContaBadge, StatusObraBadge,
                      StatusFuncionarioBadge, ImageLightbox
    camera/           CameraCapture (câmera no mobile / upload no desktop),
                      PassosCaptura (indicador 1-2-3), ConfirmacaoExtracao
    contas/           Listagem, tabela (desktop), filtros, formulário e detalhe
    obras/            Listagem e detalhe de obras (resumo financeiro)
    funcionarios/     Listagem, formulário e detalhe de funcionários
    produtos/         Gráfico de evolução de preço (recharts)
    dashboard/        KpiCard, FluxoFinanceiroChart, GastosCategoriaChart,
                      ProgressoObrasList, ContasProximasList, AtividadeRecenteList
    layout/           Sidebar (desktop), BottomNav (mobile), Topbar, Logo,
                      ShellWrapper (decide o chrome por rota), PageHeader
  lib/               Helpers puros (formatação, categorias, cn, resumo
                     financeiro, métricas do dashboard)
  app/               Telas (App Router) — ver tabela abaixo
```

## Telas

| Rota                         | Tela                                                    |
|-------------------------------|----------------------------------------------------------|
| `/`                            | Landing page (marketing, sem chrome do app) → CTA "Iniciar" leva ao dashboard |
| `/dashboard`                   | KPIs, fluxo financeiro, gastos por categoria, obras em andamento, contas próximas, atividade recente |
| `/capturar`                    | Wizard de 3 passos (Capturar → Revisar → Confirmar). No desktop pula a câmera e mostra só upload de arquivo |
| `/contas-a-pagar`              | Tabela (desktop) / lista de cards (mobile) + filtros + cadastro manual |
| `/contas-a-pagar/[id]`         | Detalhe + comprovante em tamanho real + dar baixa        |
| `/contas-a-receber`            | Idem, para recebimentos                                  |
| `/contas-a-receber/[id]`       | Idem                                                      |
| `/obras`                       | Lista de obras                                            |
| `/obras/novo`                  | Cadastro de obra                                          |
| `/obras/[id]`                  | Detalhe: resumo financeiro + contas a pagar/receber vinculadas |
| `/custos-produtos`             | Busca por material → histórico de preço, gráfico, tabela por obra/fornecedor |
| `/funcionarios`                | Lista + filtros (obra/status/busca) + cadastro            |
| `/funcionarios/novo`           | Cadastro de funcionário                                    |
| `/funcionarios/[id]`           | Detalhe + ativar/inativar                                  |
| `/configuracoes`               | Placeholder de preferências e integrações                  |

**Decisões de arquitetura:**
- A landing (`/`) fica fora do "shell" do app (sem sidebar/bottom nav) — ver
  a lista `ROTAS_SEM_CHROME` em [ShellWrapper.tsx](src/components/layout/ShellWrapper.tsx).
- A captura/revisão via IA é um wizard de estado local dentro da rota
  `/capturar` (em vez de rotas separadas por passo), para não precisar
  serializar um `Blob` de imagem entre rotas.
- No desktop (`≥768px`, [useIsDesktop.ts](src/hooks/useIsDesktop.ts)), a
  tela de captura pula `getUserMedia` e mostra só um botão de upload —
  fotografar a própria tela não faz sentido nesse contexto.

## Modelo de dados

Definido em [src/types](src/types) antes de qualquer tela, conforme pedido.
Principais tipos: `Obra`, `ContaFinanceira` (pagar/receber), `ItemProduto`
(itens de nota fiscal, alimentam a consulta de custo) e o contrato de IA
`DadosExtraidosComprovante` / `ProvedorExtracaoIA`.

Todo campo que a IA não conseguiu ler com segurança fica `undefined` em vez
de um valor chutado — a UI de confirmação destaca esses campos
(`camposComBaixaConfianca`) em amarelo para revisão manual.

## Leitura por IA (comprovante ou nota fiscal)

- A foto é enviada para `POST /api/ai/extract-recibo` ([route.ts](src/app/api/ai/extract-recibo/route.ts)), que roda no servidor.
- A própria IA classifica o documento (`comprovante` vs `nota_fiscal`) e
  extrai os campos correspondentes — o usuário pode corrigir essa
  classificação no toggle da tela de revisão.
- Provedor usado: **Anthropic Claude**, com `tool_choice` forçando saída
  JSON estruturada (evita parsing frágil de texto livre). Implementação em
  [src/services/ai/providers/anthropicProvider.ts](src/services/ai/providers/anthropicProvider.ts).
- Sem `ANTHROPIC_API_KEY` configurada, o app cai automaticamente para um
  `MockExtracaoProvider` (retorna confiança 0, força preenchimento manual) —
  assim dá para rodar e testar a UI sem custo de API.

### Configuração da API de IA

Copie `.env.example` para `.env.local` e preencha:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5   # opcional, esse é o padrão
```

Em produção (Vercel): Project Settings → Environment Variables. **Nunca**
commitar a chave real nem chamar a API de IA a partir do cliente — por isso
`anthropicProvider.ts` só é importado por `provedor.server.ts`, que só é
importado pela API route.

## Armazenamento de dados (estado atual → próximo passo)

Ainda não há banco de dados. `services/data/*.local.ts` implementa as
interfaces de repositório (`ObrasRepositorio`, `ContasRepositorio`,
`ItensProdutoRepositorio`) sobre `localStorage`, incluindo o comprovante
fotografado (guardado como data URL). Isso é suficiente para usar e
demonstrar o sistema, mas **não substitui um backend real**:

- Dados ficam só no navegador do usuário (não sincronizam entre dispositivos).
- Fotos em base64 no localStorage não escalam bem.

**Próximo passo sugerido:** Postgres (Neon/Supabase, ambos com bom suporte
Vercel) + Prisma, com upload de comprovantes para um object storage (Vercel
Blob ou S3) em vez de data URL. Como a UI só depende das interfaces em
[src/services/data/repositorios.ts](src/services/data/repositorios.ts), a
troca é: implementar `ObrasRepositorioHttp`, `ContasRepositorioHttp`,
`ItensProdutoRepositorioHttp` chamando rotas `/api/obras`, `/api/contas`,
`/api/itens-produto`, e trocar as instâncias em
[src/services/data/index.ts](src/services/data/index.ts). Nenhum componente
ou hook muda.

## Rodando localmente

```bash
yarn install
cp .env.example .env.local   # opcional — sem isso, IA roda em modo mock
yarn dev
```

Abra http://localhost:3000. Em desktop sem câmera, a tela inicial cai
automaticamente no fallback de upload/`capture=environment`.

## Scripts

- `yarn dev` — desenvolvimento
- `yarn build` — build de produção
- `yarn lint` — ESLint (inclui regras do React Compiler/hooks)
- `yarn tsc --noEmit` — checagem de tipos
