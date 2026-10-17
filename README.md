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
| `/estoque/deposito`            | Depósito: saldos, última compra, valor em estoque, onde mais o material está, transferir/devolver e histórico |
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

## Calendário e lembretes

Módulo do Elo Gestão em `/calendario` (visões mês, semana e dia). Cada compromisso é do calendário de quem o criou;
o criador pode compartilhá-lo com usuários ativos da mesma empresa, que o veem no próprio calendário e recebem os
lembretes. A empresa em si não abre o calendário pessoal de ninguém, nem o dono. Só o criador edita, exclui e compartilha.

**Lembretes.** Cada compromisso agendado gera dois: na véspera e no dia, por e-mail (Resend) e notificação no sino.
Com horário, a véspera sai 24 h antes do início e o do dia às 8h locais (nunca a menos de 60 min do início). Dia inteiro:
às 9h locais, na véspera e no dia. Lembrete cujo horário já passou na hora de criar ou editar **não** é enviado depois
do fato. Cancelar, concluir ou excluir cancela o que ainda não saiu; mudar data ou horário recalcula e permite avisar de
novo. Falha de e-mail tem até 5 tentativas (5 min, 15 min, 1 h, 3 h) e depois fica registrada como falha.

**Como funciona o disparo.** Nada depende do site aberto. Um agendador chama `POST /api/cron/lembretes`; a rota é
idempotente e reserva cada item com um UPDATE condicional, então chamadas simultâneas não duplicam. A unicidade
(lembrete, versão, usuário, canal) em `EntregaLembrete` é a segunda barreira, e o e-mail leva chave de idempotência.

**Configuração (uma vez):**

1. Gere um segredo (`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`) e defina-o como
   `CRON_SECRET` na Vercel (Production). Sem ele a rota responde 503.
2. No GitHub, em Settings > Secrets and variables > Actions, crie `CRON_SECRET` (mesmo valor) e `APP_URL` (endereço do
   site, sem barra final). O workflow `.github/workflows/lembretes.yml` chama a rota a cada 5 minutos.
3. E-mail real: `RESEND_API_KEY` e `EMAIL_REMETENTE` (já usados pela confirmação de e-mail). Sem eles, em produção o
   envio falha e vira nova tentativa; em desenvolvimento a mensagem sai no console.

Opcional: `CALENDARIO_HORA_DIA_INTEIRO` e `CALENDARIO_HORA_LEMBRETE_DO_DIA` (hora local, 0 a 23). O fuso é da empresa
(Configurações, só o dono; padrão Brasília). Preferências de e-mail e de sino são de cada usuário.

**Testes.** `yarn test` roda os testes unitários (regras puras, sem banco). `yarn testar:calendario` roda a integração
contra o banco do `.env.local`: cria duas empresas descartáveis, exercita compartilhamento, isolamento, lembretes,
repetição e concorrência (e-mail simulado) e apaga o que criou.

## Acesso por módulo (funcionários da empresa)

O dono cria os usuários da empresa em Configurações e escolhe os **módulos** de cada um (Dashboard, Calendário, Captura,
Contas a pagar, Contas a receber, Projetos, Estoque, Funcionários, Fornecedores, Elo Profissionais). O dono sempre tem
todos; um membro usa só o que foi marcado, e o dono pode mudar isso depois (precisa da própria senha). A lista de módulos
e o que cada ação exige estão numa definição só, [modulos.ts](src/lib/auth/modulos.ts), usada em três camadas: o menu
esconde o que a pessoa não usa, a página mostra "sem acesso" e, o que realmente protege, **cada Server Action confere
no servidor** (os módulos são lidos do banco a cada requisição, então revogar vale na hora). "Ler" é mais largo que
"escrever": quem lança uma conta enxerga a lista de projetos para escolher, mas só altera projetos quem tem o módulo
Projetos. Os módulos que a pessoa pode receber também respeitam o plano da empresa.

## Depósito, rateio da nota e transferências

Cada empresa tem um **Depósito**: um local de estoque especial (uma linha em `Obra` com `ehDeposito`, no máximo uma por
empresa, garantido por índice único parcial). Ele não é projeto: não aparece nas listas de projetos, não tem orçamento
e não entra nos indicadores de projeto.

**Captura de nota fiscal.** Na revisão, o campo "Destino de todos os itens" manda a nota inteira para um projeto ou para o
Depósito; em cada item é possível trocar o destino. A gravação é uma só, no servidor e numa transação
([capturaCore.server.ts](src/services/data/server/capturaCore.server.ts)): conta (ou parcelas), itens, produto do
catálogo e entrada no estoque do destino do item. Com mais de um destino, o valor da conta é **rateado proporcional ao
valor dos itens** (frete e impostos entram na mesma proporção), em centavos inteiros pelo método do maior resto, para a
soma fechar exatamente no valor da nota ([rateio.ts](src/lib/estoque/rateio.ts)). A conta continua **uma só** (um
boleto, uma baixa): o rateio fica em `RateioConta`, e a conta fica com o projeto de maior parte. Em notas parceladas,
cada parcela é rateada na mesma proporção e os itens ficam na primeira conta. A soma das parcelas precisa bater com o
valor da nota.

**Custo do projeto.** Compra para o Depósito **não** é gasto de projeto. O projeto soma: contas que têm parte dele
(só a parte dele, via rateio) + material transferido do Depósito ao valor da última compra. Isso aparece no detalhe
do projeto (seção "Materiais vindos do depósito") e no progresso de orçamento do dashboard.

**Transferir / devolver** ([depositoCore.server.ts](src/services/data/server/depositoCore.server.ts)). Duas
movimentações de estoque ligadas por `transferenciaId` (saída de um local, entrada no outro) na mesma transação; o
saldo nunca fica negativo e transferências simultâneas não passam do saldo. O valor unitário é o da última compra
(itens de contas não canceladas); sem compra, o custo médio; sem nenhum, R$ 0,00 (a tela avisa antes). Transferir não
é compra: não muda o custo médio, não cria conta e não mexe no caixa. **Devolver** ao Depósito abate o custo do projeto
pelo mesmo critério. Limite conhecido: a devolução usa a última compra *do momento*, então, se o preço mudou entre a ida
e a volta, sobra uma pequena diferença no custo do projeto.

**Testes.** `yarn testar:deposito` (integração, banco do `.env.local`): captura com rateio, parcelas, Depósito,
transferência, devolução, última compra com conta cancelada, isolamento entre empresas e concorrência; cria empresas
descartáveis e apaga o que criou.

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
