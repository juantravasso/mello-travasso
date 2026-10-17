# Elo Negócios

> Seu negócio conectado a novas possibilidades.

Plataforma para gerenciar a empresa, encontrar profissionais confiáveis e descobrir
novas oportunidades, em um só lugar. Tem duas áreas no ar e uma planejada:

- **Elo Gestão**: controle financeiro e operacional (contas a pagar/receber, projetos,
  estoque, funcionários e fornecedores), com pré-preenchimento automático via IA a partir
  de fotos de comprovantes e notas fiscais.
- **Elo Profissionais**: busca, perfis públicos, avaliações, indicações e verificação de
  empresas e autônomos (construção civil, serviços e tecnologia).
- **Elo Marketplace**: compra e venda de produtos e serviços. **Ainda não existe**; aparece
  só como visão futura (`disponivel: false`) e não tem rota.

Nome, slogan, descrição, áreas e cores da marca ficam em [src/lib/marca.ts](src/lib/marca.ts).
O logo é [Logo.tsx](src/components/layout/Logo.tsx); favicon, ícone do app, manifest e imagem
de compartilhamento são gerados por código em `src/app/` (`icon.tsx`, `apple-icon.tsx`,
`manifest.ts`, `opengraph-image.tsx`).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript estrito** (sem `any`)
- **Postgres (Neon, via integração nativa da Vercel) + Prisma 6** — banco real, compartilhado entre todos os dispositivos/usuários (ver seção própria abaixo)
- **Tailwind CSS v4** — identidade visual Elo (navy + verde-azulado, com dourado no símbolo) com tema claro alternável em [src/app/globals.css](src/app/globals.css), componentes base em [src/components/ui](src/components/ui)
- **anime.js** para as animações de modal e dropdown
- **Recharts** para os gráficos do dashboard (fluxo financeiro, gastos por categoria) e de evolução de preço
- Roteamento: **file-based routing do Next.js** (App Router) — substitui o React Router; cada pasta em `src/app` é uma tela
- Layout responsivo: sidebar colapsada em ícones em telas ≥768px ([Sidebar.tsx](src/components/layout/Sidebar.tsx)), bottom nav abaixo disso ([BottomNav.tsx](src/components/layout/BottomNav.tsx)) — ver [ShellWrapper.tsx](src/components/layout/ShellWrapper.tsx)
- IA de leitura de imagem: **Anthropic Claude (API de visão + tool use)**, chamada apenas server-side
- Gerenciador de pacotes: **yarn**
- Hospedagem alvo: **Vercel**

Por que Next.js em vez de uma SPA com Vite: as rotas de API e Server Actions
(`src/app/api/**`, `src/services/data/server/**`) rodam no mesmo projeto e
mesmo deploy da Vercel — isso resolve de graça tanto "manter a chave de IA
fora do cliente" quanto "falar com o Postgres sem expor credenciais",
sem precisar de um backend separado.

## Arquitetura de pastas

```
src/
  types/            Contratos de dados (Obra, ContaFinanceira, ItemProduto,
                     DadosExtraidosComprovante, ...) — definidos ANTES da UI.
  services/
    ai/              Camada de IA. reciboReader.ts é chamado pela UI;
                      provedor.server.ts e providers/* só rodam no servidor.
    data/            Camada de dados (repositórios). repositorios.ts define as
                      interfaces; server/*Actions.ts são Server Actions "use
                      server" que falam com o Postgres via Prisma
                      (src/lib/prisma.ts); index.ts monta os repositórios a
                      partir dessas actions. UI e hooks só conhecem as
                      interfaces — trocar de banco não toca em componente algum.
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

## Banco de dados

Postgres real (Neon, provisionado via `vercel integration add neon` e
conectado ao projeto), não mais `localStorage` — os dados são compartilhados
entre todos os dispositivos e usuários, o que era o motivo de contas
lançadas pelo celular não aparecerem no computador antes desta migração.

- Schema em [prisma/schema.prisma](prisma/schema.prisma). Datas
  (`dataVencimento`, `criadoEm`, etc.) ficam como `String` ISO, não `DateTime`
  nativo — decisão deliberada, ver comentário no topo do schema.
- `historico` de cada conta (quem criou/editou/baixou/cancelou) é um array
  JSON na própria linha, não uma tabela separada.
- Categorias e formas de pagamento criadas pelos usuários (além das opções
  padrão fixas em `src/lib/categorias.ts`) ficam em
  `CategoriaPersonalizada`/`FormaPagamentoPersonalizada`.
- `src/lib/prisma.ts` mantém um único `PrismaClient` (evita esgotar conexões
  a cada hot-reload em dev).

### Rodando migrações / seed

```bash
npx prisma db push     # aplica o schema no Postgres (sem histórico de migrations)
node prisma/seed.mjs   # dados de exemplo — só roda se o banco estiver vazio
```

O Prisma CLI lê `.env` (não `.env.local`, que é uma convenção só do Next.js)
— por isso existe um `.env` além do `.env.local`, ambos gitignorados. Rode
`vercel env pull .env.local` para trazer as variáveis de conexão do projeto
Vercel (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, etc.) e copie as duas linhas
`DATABASE_URL*` para um `.env` local.

**Nota sobre a versão do Prisma:** o Prisma 7 reestruturou o CLI inteiro em
torno da própria plataforma hospedada deles (`prisma deploy`, `prisma auth
login`, etc.) e não tem mais `prisma generate`/`db push` como comandos de
topo. Este projeto fica no **Prisma 6**, que é o ORM tradicional e funciona
com qualquer Postgres — não instale a v7 por engano.

## Rodando localmente

```bash
yarn install                 # roda "prisma generate" automaticamente (postinstall)
cp .env.example .env.local   # preencha ANTHROPIC_API_KEY (opcional — sem isso, IA roda em modo mock)
# preencha também DATABASE_URL e DATABASE_URL_UNPOOLED em .env.local e .env
# (vercel env pull .env.local traz do projeto Vercel)
yarn dev
```

**Limitação conhecida:** o comprovante fotografado ainda é salvo como data
URL (base64) numa coluna de texto (`ContaFinanceira.comprovanteUrl`), não em
um object storage dedicado. Funciona, mas infla o tamanho das linhas no
Postgres — mover para Vercel Blob/S3 é a melhoria óbvia seguinte.

Abra http://localhost:3000. Em desktop sem câmera, a tela inicial cai
automaticamente no fallback de upload/`capture=environment`.

## Scripts

- `yarn dev` — desenvolvimento
- `yarn build` — build de produção
- `yarn lint` — ESLint (inclui regras do React Compiler/hooks)
- `yarn tsc --noEmit` — checagem de tipos
