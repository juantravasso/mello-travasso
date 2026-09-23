---
name: design-sem-cara-de-ia
description: Direção visual profissional e moderna sem "cara de IA". Carregue sempre que a tarefa, PRD ou prompt envolver UI (tela, componente, layout, landing, dashboard, formulário, estados, microcopy). Usada por /prd, /prompt-gen e pelo agente design-director.
---

# Design sem cara de IA

**Fonte canônica:** `~/claude-brain/brain/developer/frontend/web/decisions/design-direction.md` (listas completas de "Evitar" e "Fazer" e o entregável mínimo). Esta skill não duplica a Brain: quem lê a Brain é o `context-scout`; aqui ficam só a precedência e o que é específico deste projeto.

## Precedência
1. Figma ou design system do projeto, se existir.
2. Identidade atual do app: **navy + dourado**, tema escuro padrão com claro alternável. Tokens em `src/app/globals.css` (`--color-primary`, `--color-surface`, `--color-surface-2`, `--color-card`, `--color-border`, `--color-muted`, semânticas `success/warning/danger/info` com `-bg`). Componentes base em `src/components/ui/` (Button, Card, Input, Select, Textarea, Badge, Modal…). **Estenda esses tokens e componentes, não crie paralelos.**
3. Regras da Brain (`design-direction.md`).

## Resumo operacional (detalhe na Brain)
- **Evitar:** gradiente roxo/azul, glassmorphism gratuito, hero centralizado + 3 cards com ícone, emoji como ícone, Inter/Poppins em tudo, mesmo raio e mesma sombra em tudo, copy genérica ("transforme seu negócio"), layout todo simétrico, dados falsos óbvios.
- **Fazer:** conceito em uma frase, referências reais do setor, par tipográfico com personalidade, paleta própria com neutros de temperatura em CSS vars, grid com assimetria intencional, estados hover/focus/empty/loading/error desenhados, microcopy específica, conteúdo real, movimento contido com `prefers-reduced-motion`, contraste AA.

## Específico deste domínio (gestão financeira de obras)
- Valores em R$ sempre com `tabular-nums` e alinhados à direita em tabelas; negativos/atrasos por semântica (`danger`), nunca só por cor (ícone ou texto junto).
- Referências de setor para citar e justificar: ferramentas de conciliação e contas a pagar (densidade de tabela, filtros persistentes), apps de banco PJ (hierarquia de saldo e vencimento), planilhas de obra (agrupamento por obra/centro de custo).
- Microcopy com verbos do domínio: "Dar baixa", "Lançar comprovante", "Vincular à obra", "Vence em 3 dias". Erros nomeiam o campo e a regra ("CNPJ precisa ter 14 dígitos").
- Conteúdo de exemplo realista: nomes de obra longos, fornecedor PF e PJ, valor zero, lista vazia, 1.000 linhas.
- Movimento: o projeto usa CSS puro no Modal e anime.js em dropdown; 120–200 ms, só feedback/continuidade, desligado sob `prefers-reduced-motion: reduce`.
- Mobile é uso real (captura de comprovante pela câmera): alvos ≥ 24×24 px (preferir 44), bottom nav, formulários de uma coluna.

## Entregável mínimo de design (em PRD ou prompt)
```
Conceito · Referências (2–4, o que tirar de cada) · Tipografia (display/texto + escala)
Tokens (CSS vars novos ou reutilizados + valores) · Grid · Formas (raio/sombra por nível)
Estados · Microcopy (3 exemplos reais) · Movimento · Proibido nesta tela (itens de "Evitar" mais tentadores)
```
Validação: `design-director`, nota ≥ 8/10.
