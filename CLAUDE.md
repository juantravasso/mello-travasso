@AGENTS.md

## Claude Brain

- **Caminho:** `~/claude-brain/brain/` (entrada: `brain.md`). A cópia em `~/.claude/brain/` pode estar desatualizada no Windows; em caso de divergência, vale `~/claude-brain/brain/`.
- **Quem lê:** só o agente `context-scout` lê a Brain de forma proativa, sempre pelo roteamento do `brain.md` e só os arquivos cujos gatilhos batem com a tarefa. Os demais agentes e skills citam caminhos da Brain, sem copiar o conteúdo para `.claude/`.
- **Precedência:** projeto (`CLAUDE.md`, `AGENTS.md`, `README.md`, `.claude/`, código) > Brain. Se a Brain contradisser o projeto, vale o projeto e o conflito é reportado.

## Fluxo

- **`/prd <feature>`** → `context-scout` → até 4 perguntas se faltar escopo → PRD em `docs/prd/<slug>.md` (RFs testáveis, RNFs com números, Mermaid + mini-ADR, ameaças/autorização/LGPD/segredos, design, métricas, riscos, fases) → revisão **em paralelo** de `security-reviewer` e `design-director` → correção de críticas/altas e reescrita do design se nota < 8 → oferece `/prompt-gen` por fase.
- **`/prompt-gen <tarefa | PRD#fase-N>`** → `context-scout` → `find-skills` (ou `npx skills find`, só busca) → rascunho (objetivo, contexto, arquitetura, segurança, design, ferramentas, passos, critério de pronto) → refino com `prompt-master` (alvo: agente de código) → lacunas para o `toolsmith` → salva em `.claude/prompts/<AAAA-MM-DD>-<slug>.md`.
- **Revisões:** `security-reviewer` (checklist + severidade + veredito APROVADO/RESSALVAS/BLOQUEADO) e `design-director` (nota 0–10, 5 eixos × 2, meta ≥ 8). UI sempre carrega a skill `design-sem-cara-de-ia`.
- **Comandos de verificação:** `yarn tsc --noEmit` · `yarn lint` · `yarn build` · `yarn audit --level high`. Testes: `yarn test` (unitários, `node:test`) e `yarn testar:*` (integração, exigem banco). Validar a UI no navegador via preview `elo-dev`.
- **Limites:** instalar skills/plugins/dependências ou criar arquivos fora de `.claude/` e `docs/` só com confirmação. Nada é apagado sem pedir.
