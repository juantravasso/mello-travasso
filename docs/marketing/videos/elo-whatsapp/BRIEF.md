---
workflow: product-launch-video
flow: automation
storyboard: no
message: "O Elo resolve a dor do dia a dia: organizar a empresa (Gestão) e achar profissionais de confiança (Profissionais)."
destination: whatsapp
aspect: "9:16"
language: pt-BR
audience: "Empresas e profissionais em grupos de WhatsApp"
length: "Gestão 40s · Profissionais 25s · Completo 45s"
angle: "Dor → solução"
---

# Vídeos do Elo para WhatsApp

## Intent

Três vídeos verticais mostrando o site funcionando de verdade, gravado no modo demo (`yarn demo:dev`, dados fictícios, banco separado, e-mail e pagamento desligados):

- `gestao/` — Elo Gestão: captura de nota por IA, baixa de conta, painel, projetos, estoque, equipe e agenda.
- `profissionais/` — Elo Profissionais: busca por profissão, perfil com avaliações e o lado do profissional (perfil publicado).
- `completo/` — os dois lados num vídeo só.

## Customizations

- Sem narração e sem música: no WhatsApp o vídeo começa mudo, então todo o recado está no texto da tela.
- Telas gravadas no tamanho de celular (390 × 844) e ampliadas para o quadro 1080 × 1920.
- Toques aparecem como um círculo verde-azulado.

## Como refazer

1. Recriar os dados da demo (datas de hoje): `yarn demo:semear --recriar` na raiz do repositório, depois `yarn demo:dev`.
2. Em `gravacao/` (precisa de `npm i playwright-core@1.51.1`): `node --import tsx gerar-nota.mts nota.svg` (rodado da raiz do repo), `node login-e-nota.mjs` (faz login e salva a sessão) e `node gravar.mjs`. Recortar os trechos para `assets/clips/` com ffmpeg (`crop=390:844:0:0`, ampliação para 760 × 1646; tempos em `clips/marcas.json`).
3. `node gerar.mjs` gera as três composições; em cada pasta, `npx hyperframes render`.
