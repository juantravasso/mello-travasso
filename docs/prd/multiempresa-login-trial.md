# PRD — Multiempresa, login e teste grátis
> Status: pronto para execução · Data: 2026-09-22 · Revisões: segurança RESSALVAS (corrigidas) · design 9/10

## 1. Resumo
**Problema:** o sistema atende uma única empresa, não tem login (o "usuário" é um nome salvo no navegador) e todas as Server Actions e a rota de IA estão abertas na internet. Não dá para oferecer o produto a outras construtoras.
**Solução:** (1) conta por **empresa (CNPJ)** ou **profissional autônomo (CPF)**, com autopreenchimento dos dados pelo CNPJ; (2) login por e-mail e senha com sessão no Postgres; (3) todos os dados isolados por empresa; (4) 30 dias de teste grátis e, depois, modo somente leitura até a cobrança ser definida.
**Por que agora:** abrir o cadastro é pré-requisito para vender, e fechar as rotas abertas corrige um risco que já existe hoje (qualquer pessoa com a URL lê e altera dados e gera custo de IA).

## 2. Usuários e contexto de uso
| Perfil | Contexto | Dispositivo |
|---|---|---|
| Dono / sócio de construtora pequena (PJ) | Cria a conta, cadastra obras, acompanha o financeiro | Desktop no escritório, celular na obra |
| Engenheiro ou empreiteiro autônomo (PF, CPF) | Controla as próprias obras sem ter CNPJ | Principalmente celular |
| Financeiro / assistente (membro) | Lança comprovantes e dá baixa | Desktop; convites ficam para fase futura, mas o modelo já suporta |
| Empresa atual (cliente original) | Continua usando sem interrupção, com plano cortesia | Os dois |

Frequência: login ~1×/semana por dispositivo (sessão de 30 dias); cadastro 1× por empresa.

## 3. Escopo
**Dentro:**
- Telas `/login` e `/criar-conta` (PJ ou PF)
- Autopreenchimento por CNPJ
- Sessão e logout
- Troca de senha
- Proteção de todas as rotas do app
- Isolamento por `empresaId` em todas as tabelas e actions
- Migração dos dados atuais para a empresa existente
- Teste de 30 dias, aviso de fim de teste e modo somente leitura
- Script para estender o teste
- Rate limit de login, cadastro e IA
- Cabeçalhos de segurança
- Validação com zod
- Adoção de `prisma migrate`

**Fora (fases futuras):**
- Cobrança e meios de pagamento
- Convite de usuários e gestão de papéis
- Recuperação de senha por e-mail e verificação de e-mail
- Login social e 2FA
- Painel de administração das empresas
- Exclusão de conta self-service
- Um usuário em várias empresas

## 4. Requisitos funcionais
| ID | Requisito (dado / quando / então) | Prioridade |
|---|---|---|
| RF-01 | **Dado** "Empresa (CNPJ)" em `/criar-conta`, **quando** o usuário completa 14 dígitos com DV válido, **então** o sistema consulta a BrasilAPI (timeout de 5 s) e preenche razão social, nome fantasia, endereço, telefone e situação cadastral; os campos continuam editáveis, exceto o CNPJ. | Must |
| RF-02 | **Dado** um CNPJ com DV inválido, **então** aparece "CNPJ inválido — confira os 14 dígitos" e nada é consultado. **Dado** falha ou timeout da consulta, **então** aparece "Não achamos esse CNPJ na Receita agora. Preencha os dados manualmente." e o formulário continua utilizável. | Must |
| RF-03 | **Dado** CNPJ com situação diferente de "ATIVA", **então** aparece um aviso ("Situação na Receita: BAIXADA"), sem bloquear o cadastro. | Should |
| RF-04 | **Dado** "Autônomo (CPF)", **quando** o CPF tem DV válido, **então** o nome completo é digitado manualmente, sem consulta externa. CPF inválido mostra "CPF inválido — confira os 11 dígitos". | Must |
| RF-05 | O cadastro exige nome do usuário, e-mail, senha (10 a 128 caracteres) e aceite dos Termos e da Política de Privacidade (grava versão e data). | Must |
| RF-06 | **Dado** documento ou e-mail já cadastrado, **então** o servidor responde com uma mensagem única e genérica ("Não foi possível criar a conta com esses dados. Se você já tem conta, entre."), sem dizer qual campo colidiu. | Must |
| RF-07 | **Quando** o cadastro é válido, **então** são criados na mesma transação a Empresa (`plano = teste`, `testeTerminaEm` = hoje + 30 dias às 23:59 de America/Sao_Paulo), o Usuário (`papel = dono`) e a Sessão, e o usuário vai para `/dashboard` já logado, com estados vazios que orientam o primeiro passo ("Cadastre sua primeira obra"). | Must |
| RF-08 | **Dado** e-mail e senha corretos em `/login`, **então** a sessão é criada e o usuário vai para o `next` informado (só caminhos relativos internos, começando com `/` e sem `//`) ou para `/dashboard`. | Must |
| RF-09 | **Dado** e-mail inexistente ou senha errada, **então** aparece a mesma mensagem ("E-mail ou senha incorretos"), com tempo de resposta equivalente (hash fictício). | Must |
| RF-10 | **Dado** 5 falhas na conta em 15 min, **então** a conta fica bloqueada por 15 min, com a mesma mensagem do RF-09. Rate limit: 5 tentativas/min por `email:ip` e 20/min por IP, com o IP lido do primeiro valor confiável de `x-forwarded-for` que a Vercel injeta (nunca aceito de um client direto). | Must |
| RF-11 | **Quando** o usuário clica em "Sair", **então** a sessão é apagada no banco, o cookie é removido e o usuário vai para `/login`. | Must |
| RF-12 | **Dado** acesso a qualquer rota do app sem sessão válida, **então** redireciona para `/login?next=<rota>`. `/`, `/login`, `/criar-conta`, `/termos` e `/privacidade` são públicas. | Must |
| RF-13 | **Dado** um usuário da empresa A, **quando** lê, altera ou referencia por id qualquer recurso da empresa B (obra, conta, fornecedor, funcionário, item, categoria, forma de pagamento), **então** o servidor responde como inexistente (404 / `null`) e nada é alterado. | Must |
| RF-14 | O histórico das contas registra nome e id do usuário **da sessão**; o parâmetro `usuario` vindo do client deixa de existir. | Must |
| RF-15 | **Dado** plano `teste` com 7 dias ou menos restantes, **então** o app mostra uma faixa: "Seu teste termina em N dias (dd/mm)". | Must |
| RF-16 | **Dado** `testeTerminaEm` no passado e plano `teste`, **então** toda action de escrita e a rota de IA respondem `SOMENTE_LEITURA`; a UI desabilita os botões de criar/editar/baixar/capturar com a explicação "Teste encerrado — os dados continuam disponíveis para consulta" e a faixa passa a mostrar "Falar com a equipe". Continuam liberados: ver dados, trocar senha, ver/editar o perfil da empresa e sair. | Must |
| RF-17 | A empresa atual é migrada com `plano = cortesia` (sem fim), recebe todos os dados existentes e ganha um primeiro usuário `dono` com senha temporária, exibida uma única vez pelo script, e troca obrigatória no 1º login. | Must |
| RF-18 | O script `yarn empresa:estender-teste <documento> <dias>` estende `testeTerminaEm` e registra quem estendeu e quando. | Must |
| RF-19 | **Quando** o usuário troca a senha (senha atual + nova), **então** todas as outras sessões dele são apagadas. | Must |
| RF-20 | `/configuracoes` mostra os dados da empresa (editáveis, exceto documento) e o status do plano ("Teste — 12 dias restantes", "Cortesia", "Teste encerrado"). | Should |
| RF-21 | Cadastro: 3 contas/hora por IP, com campo honeypot; o envio preenchido pelo bot é descartado com a resposta de sucesso aparente. | Must |
| RF-22 | `/api/ai/extract-recibo` exige sessão e plano com escrita liberada, aceita só `image/jpeg`, `image/png`, `image/webp` e `application/pdf` até 8 MB e limita a 30 extrações/hora por empresa (erro "Limite de leituras por hora atingido. Tente de novo às HH:MM."). O corpo é rejeitado (413) **antes** de `request.json()` quando o header `Content-Length` excede ~11 MB (8 MB + ~33% do inchaço do base64 + folga), e o tamanho do buffer decodificado é revalidado contra 8 MB antes de chamar o provedor de IA. | Must |

## 5. Requisitos não funcionais
- **Acessibilidade (WCAG 2.2 AA):**
  - Contraste 4,5:1 no texto e 3:1 em bordas de input e anel de foco, nos dois temas.
  - Todo campo com `<label>` visível; erros ligados por `aria-describedby`, anunciados com `aria-live="polite"`.
  - Ordem de tabulação lógica, alvos ≥ 44 px no mobile.
  - `autocomplete` correto: `email`, `current-password`, `new-password`, `organization`, `postal-code`.
  - Botão para mostrar/ocultar senha com `aria-pressed`.
- **Desempenho:**
  - `/login` e `/criar-conta`: LCP < 2,0 s em 4G, JS da rota < 90 KB gzip, INP < 200 ms.
  - Action de login: p95 < 400 ms (scrypt ~100 ms incluído).
  - Checagem de sessão (DAL): 1 query por request, memoizada com `cache()` do React.
  - Consulta de CNPJ: timeout de 5 s.
- **Confiabilidade:**
  - A migração roda em transação, com backup do Neon (branch) antes e contagem de linhas por tabela antes e depois (tem que bater).
  - O cadastro é atômico: se qualquer passo falhar, nada é gravado.
- **Custo:** IA limitada por empresa (RF-22), sem chamada de IA nas telas de auth.
- **Compatibilidade:** Chrome/Safari/Firefox atuais, Safari iOS 16+ (cookie `secure` + `sameSite=lax`).
- **Next 16:**
  - `middleware` passou a ser `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
  - `cookies()` é sempre `await` (`.../02-guides/upgrading/version-16.md`).
  - Padrão de DAL e sessão em banco: `.../02-guides/authentication.md`.
  - Actions tratadas como POST público: `.../02-guides/data-security.md`.

## 6. Arquitetura
```mermaid
flowchart LR
  subgraph Navegador
    UI[Telas / hooks] -->|chama| REPO[repositorios.ts]
    CAD[/criar-conta/] -->|CNPJ| BAPI[(BrasilAPI)]
  end
  PX[proxy.ts\nchecagem otimista do cookie] --> APP
  REPO --> SA[Server Actions *Actions.ts]
  CAD --> AUTHA[authActions.ts]
  SA --> DAL[lib/auth/dal.ts\nexigirSessao / exigirEscrita]
  AUTHA --> RL[lib/auth/limite.ts\nrate limit no Postgres]
  DAL --> PR[(Prisma → Postgres)]
  SA -->|where empresaId| PR
  API[/api/ai/extract-recibo] --> DAL
  APP[layout (app)\nverificação real + faixa do teste] --> DAL
```

**Camadas:**
- **Módulos novos**, fora de arquivos `"use server"`, que só podem exportar funções async:
  - `src/lib/auth/senha.ts`: scrypt com `N=2^15`, `r=8`, `p=1`, salt de 16 B, `timingSafeEqual`. Formato gravado: `scrypt$N$r$p$salt$hash`.
  - `src/lib/auth/sessao.ts`: token de 32 bytes aleatórios; no banco fica só o `sha256` do token. Cookie `mt_sessao` com `httpOnly`, `secure` em produção, `sameSite=lax`, `path=/`, 30 dias, renovado quando faltam menos de 15 dias.
  - `src/lib/auth/dal.ts`, com `import "server-only"` e `cache()`, expondo:
    - `exigirSessao()` → `{ usuarioId, nome, empresaId, papel }`, ou redireciona / lança `NAO_AUTENTICADO`.
    - `exigirEscrita()` → igual ao anterior, mais o bloqueio `SOMENTE_LEITURA`.
    - `statusPlano(empresa)`.
  - `src/lib/auth/limite.ts`: rate limit com janela fixa numa tabela do Postgres.
  - `src/lib/validacao/documento.ts`: DV de CPF e CNPJ, reaproveitado no client.
  - `src/lib/env.server.ts`: env validado com zod no boot.
- **Actions novas:** `src/services/data/server/authActions.ts` (`entrar`, `criarConta`, `sair`, `trocarSenha`) e `empresaActions.ts` (`obterEmpresaAtual`, `atualizarEmpresa`).
- **Actions existentes (28):**
  - 1ª linha de cada uma: `const s = await exigirSessao()`, ou `exigirEscrita()` nas de escrita.
  - Todo `where` e todo `data` recebem `empresaId: s.empresaId`.
  - `findUnique({ where: { id } })` vira `findFirst({ where: { id, empresaId } })`.
  - `update` e `delete` usam `updateMany` / `deleteMany` com `empresaId` e checam `count === 1`; **`count === 0` retorna `{ ok:false, erro:"NAO_ENCONTRADO" }`** (nunca lança exceção nem distingue "não existe" de "existe em outra empresa" — mesma resposta dos dois casos, para não vazar existência).
  - Id vindo do client que referencia outra entidade (`obraId`, `fornecedorId`) é validado como pertencente à empresa antes de gravar, com o mesmo `NAO_ENCONTRADO` em caso de falha.
- **Rotas:**
  - Route groups `src/app/(publico)/` (landing, login, criar-conta, termos, privacidade) e `src/app/(app)/` (todas as telas atuais). As pastas movem, as URLs não mudam.
  - `(app)/layout.tsx` (Server Component) chama `exigirSessao()` e passa o plano para a faixa.
  - `ShellWrapper` deixa de decidir o chrome por lista de rotas.
- **`proxy.ts`:** só verifica se o cookie existe (sem banco) e redireciona para `/login` nas rotas do app. **Não é a barreira de segurança.**
- **`next.config.ts`:** cabeçalhos `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` com câmera só `self`, e HSTS.

**Modelo de dados (diff do `schema.prisma`):**
```prisma
enum TipoPessoaDb { pj pf }
enum PlanoDb { teste cortesia ativo suspenso }
enum PapelDb { dono membro }

model Empresa {
  id                 String       @id @default(uuid())
  tipoPessoa         TipoPessoaDb
  documento          String       @unique   // só dígitos
  razaoSocial        String                  // PF: nome completo
  nomeFantasia       String?
  situacaoCadastral  String?
  telefone           String?
  emailContato       String?
  cep String?  logradouro String?  numero String?  complemento String?
  bairro String?  cidade String?  estado String?
  plano              PlanoDb      @default(teste)
  testeTerminaEm     String?                 // ISO; null em cortesia/ativo
  aceiteTermosVersao String
  aceiteTermosEm     String
  criadoEm           String
  atualizadoEm       String
  usuarios Usuario[]
  // + relações com todas as tabelas de dados
}

model Usuario {
  id                String  @id @default(uuid())
  empresaId         String
  empresa           Empresa @relation(fields: [empresaId], references: [id])
  nome              String
  email             String  @unique           // minúsculo, trim
  senhaHash         String
  papel             PapelDb @default(dono)
  trocarSenha       Boolean @default(false)
  falhasLogin       Int     @default(0)
  bloqueadoAte      String?
  criadoEm          String
  atualizadoEm      String
  sessoes Sessao[]
  @@index([empresaId])
}

model Sessao {
  id         String  @id                      // sha256(token) em hex
  usuarioId  String
  usuario    Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiraEm   String
  criadoEm   String
  ultimoUsoEm String
  @@index([usuarioId])
}

model LimiteTaxa {
  chave        String @id                     // ex.: "login:email:ip" (hash)
  janelaInicio String
  contagem     Int
}

model EventoConta {                             // auditoria de extensões de teste / mudanças de plano
  id String @id @default(uuid())
  empresaId String
  tipo String
  detalhes Json                                  // só ids e valores necessários à auditoria — nunca e-mail, senha, token ou documento em claro
  criadoEm String
  @@index([empresaId])
}

// Em Obra, ContaFinanceira, Fornecedor, ItemProduto, Funcionario,
// CategoriaPersonalizada, FormaPagamentoPersonalizada:
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id])
  @@index([empresaId])            // + índices compostos que já existem passam a começar por empresaId
```
As chaves das datas seguem o padrão do projeto: String ISO.

**Migração (prisma migrate):**
1. Baseline do banco atual: `0_init`, gerado com `prisma migrate diff` e marcado com `migrate resolve --applied`.
2. `1_multiempresa_estrutura`: cria as tabelas novas e adiciona `empresaId` como opcional.
3. `yarn migrar:empresa-atual --documento <CNPJ> --email <e-mail>`, idempotente e em transação:
   - cria a empresa `cortesia` e o dono com senha temporária;
   - faz `UPDATE ... SET "empresaId" = $1 WHERE "empresaId" IS NULL` nas 7 tabelas;
   - imprime as contagens.
4. `2_multiempresa_obrigatorio`: `empresaId` NOT NULL, FKs e índices.

Sempre com branch de backup no Neon antes.

**Contratos (TS):** `SessaoAtual`, `StatusPlano = { plano, diasRestantes: number | null, somenteLeitura: boolean }`, `ResultadoAction<T> = { ok: true; dados: T } | { ok: false; erro: CodigoErro; campos?: Record<string,string> }`, com `CodigoErro = "NAO_AUTENTICADO" | "SOMENTE_LEITURA" | "LIMITE" | "VALIDACAO" | "NAO_ENCONTRADO" | "GENERICO"`.

**Mini-ADR**
- **Contexto:** app Next na Vercel com Postgres. Sem auth hoje. Várias empresas no mesmo banco. Equipe pequena, sem orçamento para serviço de identidade.
- **Decisão:** auth próprio, com scrypt nativo e sessão opaca no Postgres. Isolamento lógico por `empresaId` aplicado num DAL único, com `proxy.ts` só otimista. Rate limit no próprio Postgres.
- **Alternativas consideradas:**
  - Auth.js: mais dependência e config, sem ganho sem login social.
  - Clerk: custo por usuário e dados fora do banco.
  - JWT stateless: não permite revogar sessão ao trocar a senha.
  - RLS do Postgres: rede de segurança melhor, mas o Prisma com pool do Neon complica o `SET app.empresa_id`. Fica como fase futura.
  - Redis/Upstash para rate limit: mais uma conta. Reavaliar se o volume crescer.
- **Consequências:**
  - Toda action nova **precisa** chamar o DAL. Mitigação: uma regra de lint (`no-restricted-imports` de `@/lib/prisma` fora de `services/data/server` e `lib/auth`) e um checklist no `security-reviewer`.
  - Cada request autenticado faz 1 query de sessão.
  - A recuperação de senha fica manual até uma fase futura.

## 7. Segurança
**Modelo de ameaças (STRIDE-lite)**
| Ameaça | Vetor | Mitigação |
|---|---|---|
| Falsificação | Força bruta / credential stuffing no login | RF-10: 5/min por `email:ip`, 20/min por IP, bloqueio de 15 min, mensagem única, hash fictício |
| Falsificação | Roubo de cookie | `httpOnly`, `secure`, `sameSite=lax`; token opaco com só o hash no banco; troca de senha revoga as outras sessões; logout apaga no servidor |
| Adulteração | Chamar a Server Action com o `id` de outra empresa (IDOR) | `where: { id, empresaId }` em tudo; `updateMany`/`deleteMany` com `count`; FKs validadas na empresa (RF-13) |
| Adulteração | `empresaId` ou `usuario` enviados pelo client | Os schemas zod **não aceitam** `empresaId`/`usuario`; o valor vem só da sessão |
| Repúdio | Não saber quem baixou a conta | Histórico com o id do usuário da sessão (RF-14); `EventoConta` para plano e teste |
| Vazamento | Enumerar e-mails/CNPJs no login e no cadastro | Mensagens genéricas (RF-06, RF-09) |
| Vazamento | Senha, token ou documento em log/URL | Prisma sem log de query em produção; nada de `console.log` com payload de auth; `next` só como caminho relativo; documento nunca em query string |
| Negação de serviço / custo | Abuso da IA ou cadastro em massa | RF-21, RF-22; limite de corpo de 8 MB |
| Elevação de privilégio | Burlar o somente leitura pela UI | `exigirEscrita()` no servidor em toda escrita e na IA; a UI só complementa |
| Open redirect | `?next=https://malicioso` | Aceita só `^/(?!/)` e caminhos conhecidos |

**Autorização por recurso**
| Recurso | Ler | Escrever | Verificação no servidor |
|---|---|---|---|
| Obras, contas, fornecedores, funcionários, itens, categorias, formas de pagamento | Qualquer usuário da empresa | Usuário da empresa com escrita liberada | `exigirSessao`/`exigirEscrita` + `empresaId` da sessão em todo `where`/`data` |
| Empresa (perfil) | Usuário da empresa | `dono` (documento imutável) | `papel === "dono"` + `id === s.empresaId` |
| Usuário (senha) | Só o próprio | Só o próprio | `usuarioId` da sessão |
| Plano / teste | Usuário da empresa | Só o script de operação (fora do app) | Não existe action para isso |

**Validação:**
- Um schema zod por action e rota, nos dois sentidos:
  - entrada, com `.strict()` para rejeitar campos extras;
  - saída do modelo de IA, antes de chegar à UI.
- CPF/CNPJ com DV, e-mail normalizado, senha de 10 a 128 caracteres, strings com limite de tamanho (ex.: nome ≤ 120).
- A resposta da BrasilAPI é tratada como não confiável: os campos são aparados e truncados, e o servidor revalida o que o client enviou.

**LGPD:**
- **Dados pessoais:** nome e e-mail do usuário; CPF e endereço do autônomo; os dados de funcionários já existentes. Passam a ficar isolados por empresa.
- **Finalidade e base legal:** execução de contrato (acesso ao serviço).
- **Minimização:** não pedimos telefone pessoal nem data de nascimento.
- **Aceite:** Termos e Política versionados (RF-05), com páginas `/termos` e `/privacidade`. O texto é fornecido pelo dono do produto (pendência).
- **Retenção:**
  - sessões expiradas apagadas por job/limpeza oportunista no login;
  - `LimiteTaxa` com chaves em hash (sem e-mail/IP em claro) e limpeza de janelas vencidas;
  - pedido de exclusão de conta atendido manualmente em até 15 dias (pendência de processo).
- **Acesso:** só usuários da própria empresa. Não há painel de admin.

**Segredos:**
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `ANTHROPIC_API_KEY`, validados em `env.server.ts`.
- A chave de IA permanece exclusiva de `src/services/ai/provedor.server.ts` (já é assim hoje) — nunca é lida em código de client; `src/app/api/ai/extract-recibo/route.ts` continua sendo um Route Handler server-side que só chama esse módulo, sem repassar a chave à resposta.
- Não há segredo de sessão: o token é aleatório e só o hash vai para o banco.
- Nada em `NEXT_PUBLIC_*`. O `.env.example` é atualizado só com nomes.

**Demais:**
- Queries só pelo Prisma; o backfill usa `$executateRaw` com template tag (parametrizado), nunca `Unsafe`.
- Rate limit em login, cadastro e IA.
- `yarn audit --level high` depois de adicionar `zod` e `server-only`.

## 8. Direção de design
- **Conceito:** *"Abrir a conta é abrir o livro-caixa da obra"*. A tela de cadastro é um formulário sóbrio de escritório de engenharia; ao lado, uma **ficha cadastral** vai se preenchendo conforme o CNPJ é digitado, como o cartão CNPJ da Receita. A confiança vem da precisão dos dados, não de ilustração.
- **Referências:**
  - *Cartão CNPJ da Receita Federal*: estrutura rotulada campo a campo, documento em monoespaçada.
  - *Onboarding PJ do Cora / Inter Empresas*: um passo por vez, documento primeiro, dados puxados automaticamente e confirmados pelo usuário.
  - *Conta Azul / Omie*: densidade de formulário financeiro, rótulos acima do campo, sem floating label.
  - *Linear login*: tela de entrada mínima, sem hero de marketing.
- **Tipografia:**
  - Mantém **Geist** para UI/texto e usa **Geist Mono** (já carregada) para CNPJ, CPF e datas da ficha, com `tabular-nums` e `letter-spacing: 0.02em`.
  - Título das telas de auth: Geist 600, 28/32 px, `tracking -0.01em`. Rótulos 13/16 px 500 em `--color-muted`. Campos 15/22 px. Erros 13/18 px.
  - Nenhuma fonte nova, para não pesar o LCP.
- **Tokens:** reutiliza `--background`, `--color-surface`, `--color-card`, `--color-border`, `--color-primary`, `--color-muted` e as semânticas. Novos, definidos para os dois temas em `globals.css`:
  - `--color-ficha-bg`: escuro `#12161f`, claro `#fbf8f1`. Papel levemente quente, remete a documento.
  - `--color-ficha-linha`: escuro `#232a3a`, claro `#e8e1d0`. Linhas pautadas da ficha.
  - `--color-foco`: `var(--color-primary)`, anel de 2 px com offset de 2 px (contraste ≥ 3:1 nos dois temas).
  - **Formas: reaproveita os raios que os componentes já usam**, em vez de criar uma escala paralela — `Input.tsx` já é `rounded-lg` (8px), `Card.tsx` e `Modal.tsx` já são `rounded-xl` (12px). A ficha cadastral é o próprio `Card`, com overrides: `<Card className="shadow-none border-[var(--color-ficha-linha)] bg-[var(--color-ficha-bg)]" />` (mantém o `rounded-xl` do componente, sem sombra, sem token de raio novo). O botão "Criar conta e começar o teste" usa `<Button variante="primary" className="shadow-none" />` para não herdar o `shadow-sm shadow-primary/20` padrão do componente.
- **Grid:**
  - **Desktop ≥ 1024 px:** 12 colunas; formulário em 5 colunas à esquerda (máx. 440 px, alinhado à esquerda com margem de 8vw) e ficha em 6 colunas à direita, com 1 de respiro. A ficha fica `sticky` enquanto o formulário rola.
  - **Login:** só a coluna do formulário, alinhada à esquerda; à direita, a assinatura do produto em texto (nome e uma linha do que ele faz), sem ilustração.
  - **Mobile:** 1 coluna; a ficha vira um bloco compacto acima do botão "Criar conta", mostrando razão social e cidade/UF.
- **Formas:**
  - Campos com `--radius-campo`, borda de 1 px e sem sombra.
  - Ficha com `--radius-cartao`, borda de 1 px `--color-ficha-linha` e sem sombra, porque não flutua.
  - Só o toast e o modal usam sombra.
  - Botão primário sólido dourado **sem** o `shadow-primary/25` da landing.
- **Estados:**
  - **Campo:** normal, hover (borda `--color-muted`), foco (`--color-foco`), erro (borda `--color-danger` + ícone + texto com campo e regra), desabilitado (opacidade 0,5 + cursor e motivo em texto).
  - **CNPJ:**
    - consultando: spinner de 16 px dentro do campo e as linhas da ficha em skeleton, **no formato real das linhas**;
    - encontrado: linhas preenchidas com fade de 150 ms;
    - não encontrado: ficha com "Preencha manualmente" e campos liberados;
    - situação ≠ ATIVA: selo `warning` na ficha, com texto.
  - **Botão enviar:**
    - carregando: texto "Criando conta…" com `aria-busy`, largura fixa;
    - erro de servidor: banner no topo do formulário com foco movido para ele.
  - **Faixa do teste:**
    - informativa (`--color-info-bg`) de D-7 a D-1;
    - `--color-warning-bg` no último dia;
    - após o fim, `--color-danger-bg` com a ação "Falar com a equipe".
    - Não pode ser fechada no estado encerrado.
  - **Somente leitura:** botões de escrita desabilitados com tooltip acessível (`aria-describedby`) e a mesma frase.
- **Microcopy:**
  - "Digite o CNPJ — buscamos razão social e endereço na Receita."
  - "Não achamos esse CNPJ na Receita agora. Preencha os dados manualmente."
  - "E-mail ou senha incorretos." · "Muitas tentativas. Tente de novo em 15 minutos."
  - "Seu teste termina em 5 dias (27/10). Seus dados ficam salvos."
  - "Teste encerrado — os dados continuam disponíveis para consulta. Para voltar a lançar comprovantes, fale com a equipe."
  - Botões: "Entrar", "Criar conta e começar o teste", "Sair".
- **Movimento:**
  - preenchimento da ficha: fade/translate de 4 px em 150 ms, com escalonamento de 30 ms por linha;
  - troca PJ ↔ PF: 120 ms;
  - com `prefers-reduced-motion: reduce`, tudo instantâneo;
  - sem animação de entrada na página de login.
- **Proibido nestas telas:**
  - hero centralizado com gradiente ou blob desfocado (a landing atual tem um blob `blur-3xl`, que não deve ser levado para o auth);
  - card de login flutuando no meio com sombra grande;
  - ilustração de pessoas ou emoji;
  - "Bem-vindo de volta! 👋";
  - floating labels;
  - lista de 3 benefícios com ícone ao lado do formulário;
  - CNPJ de exemplo falso (`00.000.000/0001-00`); o placeholder mostra só o formato `00.000.000/0000-00`.

## 9. Métricas de sucesso
| Métrica | Linha de base | Meta | Como medir |
|---|---|---|---|
| Rotas/actions acessíveis sem sessão | 29 (28 actions + IA) | 0 | Checklist do `security-reviewer` + teste manual com cookie removido |
| Vazamento entre empresas | Não aplicável | 0 em teste com 2 contas | Roteiro de isolamento (fase 2) |
| Cadastro iniciado → concluído | — | ≥ 70% | `EventoConta` (`conta_criada`) vs acessos a `/criar-conta` (log agregado) |
| CNPJ autopreenchido com sucesso | — | ≥ 90% das tentativas PJ | Contagem no servidor (sem gravar o CNPJ no log) |
| Tempo até a 1ª obra cadastrada | — | Mediana < 10 min após o cadastro | `criadoEm` da 1ª obra − `criadoEm` da empresa |
| Custo de IA por empresa em teste | Sem limite | ≤ 30 leituras/h | `LimiteTaxa` |

## 10. Riscos e pendências
| Risco / pendência | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Migração deixa linhas sem `empresaId` ou falha no meio | Média | Alto | Branch de backup no Neon, script idempotente em transação, contagem antes/depois, NOT NULL só depois |
| Action nova esquece o DAL, reabrindo o IDOR | Média | Alto | Regra de lint + checklist no `security-reviewer`; RLS como fase futura |
| Sem recuperação de senha: o usuário fica trancado fora | Alta | Médio | Reset manual por script (`yarn usuario:redefinir-senha`); recuperação por e-mail como próxima fase |
| Sem verificação de e-mail/posse do CNPJ: alguém registra o CNPJ de outra empresa, com dados da BrasilAPI (dado de terceiro, sem consentimento dele) preenchidos na ficha | Baixa | Médio | Processo manual de contestação; verificação de e-mail na próxima fase; os dados preenchidos automaticamente não são exibidos como "verificados" — a ficha marca a origem ("Dados da Receita — confirme ou corrija") |
| BrasilAPI fora do ar ou com rate limit | Média | Baixo | Timeout de 5 s + preenchimento manual (RF-02) |
| Rate limit em Postgres sob carga | Baixa | Baixo | Janela fixa com upsert atômico; reavaliar Upstash |
| Nome do produto: a landing dizia o nome do cliente original, mas o produto passa a servir outras empresas | — | Médio | **Pendência:** definir nome e marca do produto e ajustar a landing |
| Texto de Termos e Política de Privacidade | — | Alto (LGPD) | **Pendência:** o dono do produto fornece o texto (versão `2026-10`) |
| Canal do "Falar com a equipe" (e-mail ou WhatsApp) | — | Baixo | **Pendência:** definir o destino |
| CAPTCHA no cadastro | — | Médio | Honeypot + rate limit agora; Turnstile se houver abuso (exige chave e aprovação) |
| Sem suíte de testes para o isolamento | Alta | Alto | Roteiro manual com 2 contas na fase 2; lacuna enviada ao `toolsmith` |

## 11. Plano em fases
> A ordem garante que **o cadastro público só abre depois do isolamento** (senão uma conta nova veria os dados atuais).

### Fase 1 — Fundação de auth e login da empresa atual
- **Entrega:**
  - `zod` e `server-only`;
  - `env.server.ts`;
  - baseline do `prisma migrate` e migration `1_multiempresa_estrutura`;
  - `lib/auth/*` (senha, sessão, DAL, limite);
  - script `migrar:empresa-atual`, que também faz o backfill;
  - `/login`, logout, troca de senha obrigatória, route groups `(publico)`/`(app)`, `proxy.ts`, cabeçalhos de segurança.
- **RFs:** 08, 09, 10, 11, 12, 17, 19.
- **Pronto quando:**
  - `yarn tsc --noEmit`, `yarn lint` e `yarn build` passam;
  - no navegador: sem cookie redireciona, login certo e errado, bloqueio após 5 falhas, logout, troca de senha;
  - contagens da migração batem.
- **Depende de:** backup do Neon e o CNPJ/e-mail da empresa atual.

### Fase 2 — Isolamento de dados
- **Entrega:**
  - migration `2_multiempresa_obrigatorio`;
  - DAL nas 28 actions + `empresaActions`;
  - `findFirst`/`updateMany` com `empresaId`;
  - FKs validadas;
  - histórico com o usuário da sessão e remoção do `useUsuarioAtual`;
  - `extract-recibo` com sessão, MIME, tamanho e limite;
  - regra de lint para imports de `@/lib/prisma`.
- **RFs:** 13, 14, 22.
- **Pronto quando:**
  - typecheck, lint e build passam;
  - **teste automatizado mínimo de isolamento** (`yarn tsc --noEmit` + um script Node/tsx próprio, já que não há runner): 2 empresas fixture, e para cada uma das 7 tabelas com `empresaId`, 1 tentativa de ler/atualizar/apagar um recurso da outra empresa retorna `NAO_ENCONTRADO` — roda antes do roteiro manual, que continua como checagem complementar via DevTools;
  - IA sem sessão responde 401.
- **Depende de:** Fase 1.

### Fase 3 — Cadastro público com CNPJ/CPF
- **Entrega:**
  - `/criar-conta` com PJ/PF, ficha cadastral e BrasilAPI;
  - validação de DV;
  - honeypot e limite de cadastro;
  - aceite de termos com `/termos` e `/privacidade`;
  - estados vazios de primeira execução;
  - CTA "Entrar / Criar conta" na landing.
- **RFs:** 01, 02, 03, 04, 05, 06, 07, 21.
- **Pronto quando:**
  - typecheck, lint e build passam;
  - no navegador: CNPJ válido (autopreenche), inválido, inexistente, BrasilAPI bloqueada (manual), CPF, duplicado (mensagem genérica), temas claro/escuro, mobile a 375 px, teclado;
  - `design-director` ≥ 8.
- **Depende de:** Fase 2 e o texto dos Termos.

### Fase 4 — Teste grátis e somente leitura
- **Entrega:**
  - `statusPlano`;
  - `exigirEscrita()` aplicado;
  - faixa do teste;
  - botões desabilitados com explicação;
  - status do plano em `/configuracoes`;
  - script `empresa:estender-teste` com `EventoConta`.
- **RFs:** 15, 16, 18, 20.
- **Pronto quando:**
  - typecheck, lint e build passam;
  - no navegador, com `testeTerminaEm` ajustado por script: D-7, D-1, encerrado (escrita e IA bloqueadas no servidor, leitura OK), extensão reabre a escrita; a empresa cortesia não mostra faixa.
- **Depende de:** Fase 2 (pode rodar em paralelo à Fase 3).
