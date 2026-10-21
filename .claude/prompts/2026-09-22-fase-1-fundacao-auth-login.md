# Prompt de execução — Fase 1: fundação de auth e login da empresa atual
<!-- origem: docs/prd/multiempresa-login-trial.md#fase-1 · gerado em 2026-09-22 -->

## Objetivo
Depois desta fase, a empresa atual (cliente original) só entra no app com e-mail e senha, com sessão persistida no Postgres — nenhuma rota do app fica acessível sem login, e o app inteiro continua funcionando exatamente como hoje para quem está logado. RFs cobertos: RF-08, RF-09, RF-10, RF-11, RF-12, RF-17, RF-19 (`docs/prd/multiempresa-login-trial.md`, seção 4).

Isolamento por empresa (`empresaId` nas 28 Server Actions), cadastro público com CNPJ/CPF e o período de teste **não fazem parte desta fase** — ficam para as Fases 2, 3 e 4 do mesmo PRD. NUNCA implemente nada disso agora, mesmo que pareça natural (ex.: não adicione `empresaId` ao schema além do que esta fase pede). Implemente só o que está listado em "Passos"; não faça refatorações, limpezas ou melhorias fora do escopo, mesmo que veja oportunidade.

**Escopo de arquivos (lock):** você pode criar arquivos novos em `src/lib/auth/`, `src/lib/env.server.ts`, `src/lib/validacao/`, `src/services/data/server/authActions.ts`, `src/services/data/server/empresaActions.ts`, `src/app/proxy.ts`, `scripts/migrar-empresa-atual.ts`, `prisma/migrations/`, e as páginas/layouts listados em "Arquitetura". Você pode editar `prisma/schema.prisma` (só para adicionar, nunca remover), `package.json`, `.env.example`, `src/components/layout/ShellWrapper.tsx` e `src/app/configuracoes/page.tsx` (para o formulário de troca de senha). Não edite nenhum outro arquivo fora desta lista sem antes explicar por que é necessário e pedir confirmação.

**Pare e pergunte antes de:** rodar qualquer `prisma migrate` contra o banco (peça confirmação de backup a cada execução, não só na primeira), apagar qualquer arquivo, instalar dependência não listada em "Segurança → Dependência nova", ou editar qualquer arquivo fora do escopo acima.

## Contexto
- **Stack real:** Next.js 16.3.5 (App Router), React 19.2.8, TypeScript estrito (sem `any`), Prisma 6 + Postgres (Neon), Tailwind v4, yarn 1.22 (sem workspaces).
- **Next 16 muda APIs que você conhece de treino — leia antes de mexer:**
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — `middleware.ts` foi renomeado para `proxy.ts` (export `proxy`, não `middleware`); roda em Node por padrão, sem `config.runtime`.
  - `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — `cookies()` e `headers()` são sempre `await`, nunca síncronos.
  - `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — padrão de sessão em banco + DAL com `cache()`, e o proxy só faz checagem otimista (só olha se o cookie existe, sem consultar o banco).
  - `node_modules/next/dist/docs/01-app/02-guides/data-security.md` — toda Server Action é um endpoint POST público; autenticar dentro dela, nunca confiar só em quem a chamou.
- **Arquivos a ler antes de começar:**
  - `prisma/schema.prisma` (inteiro) — 7 modelos existentes, todas as datas são `String` ISO (comentário no topo do arquivo explica por quê; siga o mesmo padrão nos campos novos, nunca `DateTime`). Não existe `prisma/migrations/` ainda — o banco é gerido hoje só por `prisma db push`.
  - `src/lib/prisma.ts` — client Prisma já é singleton via `globalThis`; reuse-o, não crie outra instância (exceto nos scripts `.mjs`/`tsx` avulsos, que seguem o padrão de `prisma/seed.mjs` — instância local + `prisma.$disconnect()` no fim).
  - `src/services/data/server/obrasActions.ts` — modelo de convenção para `authActions.ts` e `empresaActions.ts`: `"use server"` na 1ª linha, função privada `paraX()` para mapear registro→tipo de domínio, funções exportadas em verbo+substantivo português (`entrar`, `criarConta`, `sair`, `trocarSenha`).
  - `src/app/layout.tsx` e `src/components/layout/ShellWrapper.tsx` — hoje o chrome (Sidebar/Topbar/BottomNav) é decidido por uma lista de pathnames (`ROTAS_SEM_CHROME = ["/"]`) dentro do `ShellWrapper`, renderizado globalmente pelo `RootLayout`. Depois desta fase, quem decide o chrome é o route group (`(publico)` sem chrome, `(app)` com chrome via um layout próprio que chama `exigirSessao()`).
  - `.env.example` — hoje só tem `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` (comentados: `DATABASE_URL`, `NEXT_PUBLIC_API_BASE_URL`). `.env`/`.env.local` já têm `DATABASE_URL` e `DATABASE_URL_UNPOOLED` reais, mais várias variáveis Neon (`PGHOST`, `PGPASSWORD`, `POSTGRES_*` etc.) que **não são usadas** pelo Prisma nem pelo app — não leia os valores, e não faça `env.server.ts` validar essas variáveis extras, só as 3 que o app de fato consome: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ANTHROPIC_API_KEY`.
- **Convenções que valem:** TypeScript estrito sem `any`; tipos em `src/types` antes da UI; UI e hooks só conhecem as interfaces de `src/services/data/repositorios.ts`; acesso a banco só em `src/services/data/server/*Actions.ts` (e nos módulos novos de `src/lib/auth/`); IA só em `*.server.ts`; componentes base de `src/components/ui/` (reuse `Button`, `Card`, `Input`); tokens de `src/app/globals.css`.
- **Scripts novos** (`migrar:empresa-atual`, e qualquer outro desta fase): escreva em TypeScript executado com `tsx` (adicionar como devDependency — não existe no projeto ainda), não em `.mjs` puro como `seed.mjs`, porque mexem com senha e migração de dados sensíveis e merecem checagem de tipos.

## Arquitetura
Camadas que mudam nesta fase (PRD §6):

```
Novo, fora de "use server" (só podem exportar async):
  src/lib/env.server.ts        → env validado com zod no boot (import "server-only")
  src/lib/auth/senha.ts        → scrypt (N=2^15, r=8, p=1, salt 16B), formato "scrypt$N$r$p$salt$hash", comparação com timingSafeEqual
  src/lib/auth/sessao.ts       → token opaco de 32 bytes aleatórios; só o sha256(token) em hex vai para o banco; cookie "mt_sessao" httpOnly, secure em produção, sameSite=lax, path=/, 30 dias, renovado quando faltam <15 dias
  src/lib/auth/dal.ts          → import "server-only" + cache() do React; exigirSessao() (retorna {usuarioId, nome, empresaId, papel} ou redireciona/lança NAO_AUTENTICADO); exigirEscrita() pode ficar com um TODO explícito (o bloqueio de somente-leitura é Fase 4, ainda não há testeTerminaEm)
  src/lib/auth/limite.ts       → rate limit de janela fixa numa tabela do Postgres (LimiteTaxa)
  src/lib/validacao/          → schemas zod reaproveitáveis (email, senha)

Novo, Server Actions:
  src/services/data/server/authActions.ts    → entrar, sair, trocarSenha (criarConta fica esqueleto/placeholder — cadastro público é Fase 3)
  src/services/data/server/empresaActions.ts → obterEmpresaAtual (só leitura, para a Fase 1 usar; escrita fica para depois)

Rotas:
  src/app/proxy.ts                     → checagem otimista do cookie "mt_sessao" nas rotas de (app); sem consultar o banco
  src/app/(publico)/login/page.tsx     → tela de login
  src/app/(publico)/layout.tsx         → layout sem chrome (o que hoje ShellWrapper faz para "/")
  src/app/(app)/layout.tsx             → chama exigirSessao(), redireciona para /login?next=<rota> se não houver sessão, renderiza o ShellWrapper com chrome
  src/app/(app)/... (mover)            → dashboard, obras, contas-a-pagar, contas-a-receber, custos-produtos, funcionarios, cadastro, capturar, configuracoes, api/ai movem para dentro do grupo (URLs não mudam, só o caminho de arquivo)
  src/app/(publico)/page.tsx           → landing atual (era src/app/page.tsx)
```

**Diff do schema** (`prisma/schema.prisma`) — adicionar ao final, sem tocar nos 7 modelos existentes:
```prisma
enum PapelDb { dono membro }

model Empresa {
  id                 String   @id @default(uuid())
  documento          String   @unique
  razaoSocial        String
  criadoEm           String
  atualizadoEm       String
  usuarios Usuario[]
}

model Usuario {
  id           String   @id @default(uuid())
  empresaId    String
  empresa      Empresa  @relation(fields: [empresaId], references: [id])
  nome         String
  email        String   @unique
  senhaHash    String
  papel        PapelDb  @default(dono)
  trocarSenha  Boolean  @default(false)
  falhasLogin  Int      @default(0)
  bloqueadoAte String?
  criadoEm     String
  atualizadoEm String
  sessoes Sessao[]
  @@index([empresaId])
}

model Sessao {
  id          String   @id
  usuarioId   String
  usuario     Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiraEm    String
  criadoEm    String
  ultimoUsoEm String
  @@index([usuarioId])
}

model LimiteTaxa {
  chave        String @id
  janelaInicio String
  contagem     Int
}
```
`Empresa` e `Usuario` desta fase são um subconjunto do schema completo do PRD (§6) — só os campos que o login e a migração da empresa atual precisam. Campos de plano/teste (`tipoPessoa`, `plano`, `testeTerminaEm`, endereço, aceite de termos) entram nas Fases 3/4; não os adicione agora nem crie os enums `TipoPessoaDb`/`PlanoDb` ainda vazios.

**Migrations (`prisma migrate`, substituindo `db push` a partir de agora):**
1. Gerar a baseline contra o banco real: `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql` (criar a pasta manualmente com esse arquivo), depois `npx prisma migrate resolve --applied 0_init`. **Antes disso, confirme com o usuário que existe um backup/branch do Neon** — não rode nada contra o banco de produção sem essa confirmação.
2. `npx prisma migrate dev --name multiempresa_fundacao_auth` para a migration com as tabelas novas acima.
3. Script `scripts/migrar-empresa-atual.ts` (rodado com `tsx`, chamado por `yarn migrar:empresa-atual --documento <CNPJ> --email <email>`): dentro de uma transação Prisma, cria a `Empresa` e o `Usuario` (`papel: "dono"`, `trocarSenha: true`), gera uma senha temporária aleatória (ex. 16 caracteres, `crypto.randomBytes`), faz o hash com `src/lib/auth/senha.ts`, e **imprime a senha em texto uma única vez no terminal**, nunca a grava em log nem a retorna de outro jeito. Argumentos via `process.argv` simples (sem dependência de CLI nova).

## Segurança (obrigatório)
- **Validação de entrada no servidor com schema (zod):** `entrar` valida e-mail e senha; `trocarSenha` valida senha atual + nova (10–128 caracteres); todo schema usa `.strict()`. Adicione `zod` como dependency.
- **Autorização por recurso:** `exigirSessao()` é a única fonte de identidade no servidor — nunca aceite `usuarioId`/`empresaId` vindo do client. Nesta fase só existe 1 empresa, mas **escreva o DAL já pensando em `empresaId` da sessão**, porque a Fase 2 vai chamá-lo de dentro de cada action existente.
- **Segredos só em env validado:** `src/lib/env.server.ts` com zod, lido só de `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ANTHROPIC_API_KEY`; nada em `NEXT_PUBLIC_*`. A chave de IA continua exclusiva de `src/services/ai/provedor.server.ts` — não toque nesse arquivo.
- **Nada sensível em log ou URL:** nunca `console.log` de senha, hash ou token; a senha temporária do script só vai para stdout do terminal, uma vez; `next` do redirect de login só aceita caminho relativo interno (`^/(?!/)`, sem domínio), para não virar open redirect.
- **Queries parametrizadas:** só Prisma Client; se o `prisma migrate diff` gerar SQL bruto, ele roda via `migrate`, nunca via `$queryRawUnsafe` em código da aplicação.
- **Login:** mesma mensagem genérica para e-mail inexistente e senha errada ("E-mail ou senha incorretos"); se o e-mail não existir, gere um hash fictício antes de comparar, para o tempo de resposta não vazar qual dos dois casos ocorreu.
- **Rate limit:** 5 tentativas/min por `email:ip` e 20/min por IP em `entrar`, usando `LimiteTaxa`; bloqueio de 15 min após 5 falhas na mesma conta (campos `falhasLogin`/`bloqueadoAte` em `Usuario`), com a mesma mensagem genérica. Leia o IP do primeiro valor confiável de `x-forwarded-for` (`await headers()`), nunca de um campo enviado pelo client.
- **Troca de senha:** ao trocar, apague todas as outras `Sessao` do usuário (`deleteMany({ where: { usuarioId, id: { not: sessaoAtualId } } })`).
- **Dependência nova:** `zod`, `server-only`, `tsx` — justificativa: validação de schema no servidor, garantir que módulos de servidor nunca entrem no bundle do client, e rodar os scripts de migração em TypeScript. Depois de instalar, rode `yarn audit --level high`.

## Design
Fase com pouca UI: só a tela `/login`. Entregável mínimo da skill `design-sem-cara-de-ia`:
- **Conceito:** entrada sóbria de escritório, não uma tela de marketing — sem o blob desfocado nem o grid pontilhado que a landing usa hoje.
- **Layout:** só a coluna do formulário (máx. 440px), alinhada à esquerda com margem de 8vw, sem card flutuando centralizado; a landing mantém seu visual atual, sem mudança.
- **Componentes:** reuse `Input` (`rounded-lg` já existente, não crie token de raio novo), `Button` variante `primary`.
- **Estados:** campo com erro nomeia o campo e a regra ("E-mail ou senha incorretos", nunca "credenciais inválidas" genérico demais); botão em loading mostra "Entrando…" com `aria-busy` e largura fixa (não pula layout); bloqueio por 15 min mostra a mesma mensagem do erro de credencial, sem contagem regressiva (não revelar o tempo exato ajuda contra automação, mas isso é call de produto — se preferir mostrar o tempo, é uma decisão do usuário, não sua).
- **Acessibilidade:** `<label>` visível em cada campo, erro ligado por `aria-describedby` e anunciado com `aria-live="polite"`, botão de mostrar/ocultar senha com `aria-pressed`, `autocomplete="email"` e `autocomplete="current-password"`, contraste AA nos dois temas.
- **Proibido nesta tela:** ilustração ou emoji, "Bem-vindo de volta! 👋", floating labels, card com sombra grande, gradiente.
- Sem tela de cadastro nesta fase — não crie `/criar-conta` (fica só um link comentado ou nada, é Fase 3).

## Ferramentas
- `review-changes` (skill do projeto) — rode ao final para revisar o diff contra os padrões do repo.
- `security-reviewer` (agente do projeto) — rode contra os arquivos novos de auth antes de considerar pronto.
- Skills externas encontradas via `npx skills find` (só busca, **não instaladas** — avalie e peça para eu instalar se quiser usar):
  - `mindrally/skills@zod-schema-validation` — padrões de schema zod.
  - `sickn33/agentic-awesome-skills@react-nextjs-development` — convenções gerais Next/React.
  - Comando de instalação, se decidir usar: `npx skills add <owner/repo>@<skill>`.

## Passos
Execute na ordem. Depois de cada passo, rode `yarn tsc --noEmit` sobre os arquivos tocados até ali e escreva uma linha `✅ Passo N: <o que foi feito>` antes de seguir para o próximo — isso é o checkpoint que prova que a etapa anterior compila antes de empilhar a seguinte.

1. Adicionar `zod`, `server-only` e `tsx` (devDependency) ao `package.json`; rodar `yarn install`. Adicionar o script `"typecheck": "tsc --noEmit"`.
2. Criar `src/lib/env.server.ts` com o schema zod das 3 variáveis; importar e validar no topo de `src/lib/prisma.ts` (falha rápido se faltar alguma).
3. Adicionar os modelos `Empresa`, `Usuario`, `Sessao`, `LimiteTaxa` e o enum `PapelDb` ao final de `prisma/schema.prisma`, seguindo o padrão String ISO para datas. Não remova nem renomeie nada existente no arquivo.
4. **Parar e confirmar com o usuário que há backup/branch do Neon antes de mexer no banco.** Só depois da confirmação: gerar a baseline `0_init` e rodar `prisma migrate dev --name multiempresa_fundacao_auth`.
5. Criar `src/lib/auth/senha.ts` (hash/verify com scrypt). Verificação obrigatória antes de seguir: escrever um teste manual (script ad hoc descartável ou `node -e`) que gera um hash e confirma que `verificar(senhaCerta, hash) === true` e `verificar(senhaErrada, hash) === false`; mostrar o resultado.
6. Criar `src/lib/auth/sessao.ts` (gerar token, criar/ler/apagar `Sessao`, ler/gravar o cookie `mt_sessao` com `await cookies()`).
7. Criar `src/lib/auth/limite.ts` (checar e incrementar `LimiteTaxa` por chave e janela).
8. Criar `src/lib/auth/dal.ts` com `exigirSessao()` (`cache()` + `redirect` para `/login?next=...` quando não há sessão) e um `exigirEscrita()` que por ora só chama `exigirSessao()` com um comentário `// TODO Fase 4: bloquear quando testeTerminaEm expirar`.
9. Criar `src/services/data/server/authActions.ts` com `entrar` (rate limit → busca por e-mail → hash fictício se não achar → verifica senha → bloqueio de 15 min após 5 falhas → cria sessão → seta cookie), `sair` (apaga a `Sessao` atual, remove o cookie) e `trocarSenha` (verifica a atual, grava a nova, apaga as outras sessões).
10. Criar `src/services/data/server/empresaActions.ts` com `obterEmpresaAtual` (via `exigirSessao`).
11. Criar `src/app/proxy.ts` com a checagem otimista de cookie nas rotas que não estão em `(publico)`.
12. Criar os route groups: mover as pastas de página existentes para `src/app/(app)/`, criar `src/app/(app)/layout.tsx` (chama `exigirSessao`, renderiza `ShellWrapper`), mover a landing para `src/app/(publico)/page.tsx`, criar `src/app/(publico)/layout.tsx` (sem chrome) e `src/app/(publico)/login/page.tsx`. Ajustar `ShellWrapper.tsx` para não precisar mais de `ROTAS_SEM_CHROME` (ele só é usado dentro de `(app)` agora). Verificação: nenhuma URL pública existente pode mudar — liste as rotas antes e depois e confirme que são as mesmas.
13. Construir a tela de login (client component com `useActionState` chamando `entrar`) e a troca de senha (reaproveitar `/configuracoes`, adicionando um formulário ali — não criar tela dedicada, isso é fora desta fase).
14. Criar `scripts/migrar-empresa-atual.ts`. **Parar e pedir ao usuário o CNPJ/CPF e o e-mail reais da empresa atual antes de rodar.** Depois de rodar, avisar explicitamente que a senha temporária impressa no terminal precisa ser guardada agora, porque não será mostrada de novo.
15. Atualizar `.env.example` com os nomes `DATABASE_URL` e `DATABASE_URL_UNPOOLED` (sem valores).
16. Rodar a skill `review-changes` e o agente `security-reviewer` sobre o diff completo da fase; corrigir todos os achados críticos e altos antes de considerar a fase concluída.

## Restrições
- NUNCA apague arquivo, branch, migration ou dado existente sem pedir e receber confirmação explícita nesta conversa.
- NUNCA instale dependência fora de `zod`, `server-only`, `tsx` sem perguntar antes.
- NUNCA mexa no schema além dos 4 modelos/1 enum listados na seção Arquitetura; NUNCA adicione `empresaId` às 7 tabelas existentes (isso é Fase 2, não desta prompt).
- NUNCA crie `/criar-conta` nem lógica de validação de CNPJ/CPF (Fase 3); NUNCA implemente lógica de plano/teste/somente-leitura além do comentário `TODO` em `exigirEscrita()` (Fase 4).
- NUNCA rode `prisma migrate` contra o banco sem a confirmação do Passo 4 já dada nesta conversa — peça de novo se a sessão for retomada depois de uma pausa.
- NUNCA mude uma URL pública existente ao criar os route groups — é regressão, não refatoração aceitável.
- Fique dentro do "Escopo de arquivos (lock)" definido no Objetivo. Se precisar tocar em algo fora dele, pare e explique por quê antes de editar.

## Critério de pronto
- [ ] `yarn typecheck` (`tsc --noEmit`) sem erros
- [ ] `yarn lint` sem erros
- [ ] `yarn build` passa
- [ ] Sem suíte de testes no projeto: verificar no navegador via preview (`elo-dev`): acessar `/dashboard` sem cookie redireciona para `/login?next=/dashboard`; login com credencial errada 5x bloqueia por 15 min com mensagem genérica; login correto entra e volta para a rota de origem; logout limpa a sessão; troca de senha invalida outras sessões (testar com 2 abas); `/` (landing) continua acessível sem login; tema claro/escuro e mobile (375px) na tela de login
- [ ] Migração rodada com sucesso: a empresa atual e o usuário dono existem no banco, a senha temporária funciona e força troca no primeiro login
- [ ] Checklist de segurança atendido; `security-reviewer` sem crítica/alta
- [ ] `design-director` ≥ 8/10 na tela de login (rode se o agente estiver disponível; caso contrário, confira manualmente contra a seção "Design" acima)
