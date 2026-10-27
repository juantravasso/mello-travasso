// Gera as três composições (gestao.html, profissionais.html, completo.html) a partir dos roteiros abaixo.
// Os clipes em assets/clips/ são gravações reais do site em modo demo (dados fictícios), já cortadas e aceleradas.
// Rodar: node gerar.mjs   →   depois, em cada pasta (gestao/, profissionais/, completo/): npx hyperframes render
import { cpSync, mkdirSync, writeFileSync } from "node:fs";

const SITE = "eloprofissionais.com.br";

// Cada cena: dur (s), título (texto com *destaque*), e o que aparece: clipes no celular, um gancho ou o fechamento.
const VIDEOS = {
  gestao: {
    titulo: "Elo Gestão",
    cenas: [
      { tipo: "gancho", dur: 4.5, titulo: "Ainda controla a obra no *caderno e no WhatsApp*?", dores: ["Conta esquecida vira multa", "Nota fiscal perdida", "Lucro só no fim do mês"] },
      { tipo: "app", titulo: "Tire foto da nota. *A IA lança pra você.*", clipes: [["g_captura1", 3.6], ["g_captura2", 5.2]] },
      { tipo: "app", titulo: "Veja o que vence e *dê baixa em um toque.*", clipes: [["g_baixa1", 3.13], ["g_baixa2", 5.93]] },
      { tipo: "app", titulo: "Entradas, saídas e gastos *num só painel.*", clipes: [["g_painel", 6.07]] },
      { tipo: "app", titulo: "E ainda:", clipes: [["g_obra", 1.73, "Projetos"], ["g_estoque", 1.73, "Estoque"], ["g_equipe", 1.73, "Equipe"], ["g_agenda", 1.73, "Agenda"]] },
      { tipo: "fim", dur: 4.66, produto: "Elo Gestão", frase: "Sua empresa organizada no celular.", acao: "Comece grátis" },
    ],
  },
  profissionais: {
    titulo: "Elo Profissionais",
    cenas: [
      { tipo: "gancho", dur: 3.5, titulo: "Precisa de um *encanador de confiança*?", dores: ["Indicação nem sempre resolve"] },
      { tipo: "app", titulo: "Busque por *profissão e cidade.*", clipes: [["p_busca1", 5.13]] },
      { tipo: "app", titulo: "Veja a nota e *o que outros clientes disseram.*", clipes: [["p_busca2", 6.0]] },
      { tipo: "app", titulo: "É profissional? *Crie seu perfil e seja encontrado.*", clipes: [["p_meu", 1.9], ["p_perfil", 4.47]] },
      { tipo: "fim", dur: 4.0, produto: "Elo Profissionais", frase: "Busque grátis ou crie seu perfil.", acao: "Acesse agora" },
    ],
  },
  completo: {
    titulo: "Elo Negócios",
    cenas: [
      { tipo: "gancho", dur: 4.0, titulo: "Organize sua empresa e *ache profissionais de confiança.*", dores: ["Tudo num app só"] },
      { tipo: "app", titulo: "Foto da nota: *a IA lança a conta.*", clipes: [["g_captura1", 3.6], ["g_captura2", 5.2]] },
      { tipo: "app", titulo: "Contas em dia, *baixa em um toque.*", clipes: [["g_baixa2", 5.93]] },
      { tipo: "app", titulo: "O mês inteiro *num só painel.*", clipes: [["g_painel", 6.07]] },
      { tipo: "app", titulo: "E ainda:", clipes: [["g_obra", 1.73, "Projetos"], ["g_estoque", 1.73, "Estoque"]] },
      { tipo: "ponte", dur: 2.24, titulo: "E quando precisar *contratar alguém?*" },
      { tipo: "app", titulo: "Ache profissionais *avaliados perto de você.*", clipes: [["p_busca1", 5.13], ["p_busca2", 3.37]] },
      { tipo: "fim", dur: 6.0, produto: "Elo Negócios", frase: "Gestão e profissionais num só lugar. Para empresas e autônomos.", acao: "Comece grátis" },
    ],
  },
};

const destacar = (t) => t.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>');
const r2 = (n) => Math.round(n * 1000) / 1000;

function gerar(id, v) {
  let t = 0;
  const html = [];
  const anim = [];
  const fasesCelular = []; // [início, fim] em que o celular aparece
  v.cenas.forEach((c, i) => {
    const dur = c.tipo === "app" ? c.clipes.reduce((s, [, d]) => s + d, 0) : c.dur;
    const ini = r2(t), fim = r2(t + dur);
    if (c.tipo === "app") {
      html.push(`<div id="h${i}" class="clip head" data-start="${ini}" data-duration="${r2(dur)}" data-track-index="2"><h1 class="inner">${destacar(c.titulo)}</h1></div>`);
      anim.push(`tl.fromTo("#h${i} .inner", { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${r2(ini + 0.05)});`);
      let tc = t;
      c.clipes.forEach(([nome, d, rotulo], k) => {
        html.push(`<!--CLIPE ${nome} ${r2(tc)} ${d}-->`);
        if (rotulo) {
          html.push(`<div id="c${i}_${k}" class="clip chip-wrap" data-start="${r2(tc)}" data-duration="${d}" data-track-index="3"><div class="chip">${rotulo}</div></div>`);
          anim.push(`tl.fromTo("#c${i}_${k} .chip", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" }, ${r2(tc + 0.02)});`);
        }
        tc += d;
      });
      fasesCelular.push([ini, fim]);
    } else if (c.tipo === "gancho" || c.tipo === "ponte") {
      const dores = (c.dores ?? []).map((d, k) => `<li id="d${i}_${k}">${d}</li>`).join("");
      html.push(`<div id="s${i}" class="clip center" data-start="${ini}" data-duration="${r2(dur)}" data-track-index="2"><div class="inner"><h1 class="big">${destacar(c.titulo)}</h1>${dores ? `<ul class="dores ${c.tipo === "gancho" && c.dores.length > 1 ? "x" : ""}">${dores}</ul>` : ""}</div></div>`);
      anim.push(`tl.fromTo("#s${i} .big", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${r2(ini + 0.1)});`);
      (c.dores ?? []).forEach((_, k) => anim.push(`tl.fromTo("#d${i}_${k}", { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, ${r2(ini + 0.9 + k * 0.55)});`));
      anim.push(`tl.to("#s${i} .inner", { opacity: 0, y: -30, duration: 0.3, ease: "power2.in" }, ${r2(fim - 0.3)});`);
    } else if (c.tipo === "fim") {
      html.push(`<div id="s${i}" class="clip center fim" data-start="${ini}" data-duration="${r2(dur)}" data-track-index="2"><div class="inner">
        <svg class="logo" viewBox="0 0 120 64" aria-hidden="true"><rect x="6" y="10" width="62" height="44" rx="22" fill="none" stroke="#2dd4bf" stroke-width="10"/><rect x="52" y="10" width="62" height="44" rx="22" fill="none" stroke="#e8b04b" stroke-width="10"/></svg>
        <p class="produto">${c.produto}</p>
        <p class="frase">${c.frase}</p>
        <p class="botao">${c.acao}</p>
        <p class="site">${SITE}</p>
      </div></div>`);
      const els = ["logo", "produto", "frase", "botao", "site"];
      els.forEach((e, k) => anim.push(`tl.fromTo("#s${i} .${e}", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${r2(ini + 0.1 + k * 0.18)});`));
      anim.push(`tl.fromTo("#s${i} .botao", { scale: 1 }, { scale: 1.06, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 3 }, ${r2(ini + 1.3)});`);
    }
    t += dur;
  });
  const total = r2(t);

  // Clipes de vídeo dentro do celular (o celular não é cronometrado; cada vídeo é).
  const videos = html
    .filter((l) => l.startsWith("<!--CLIPE"))
    .map((l, n) => {
      const [, nome, ini, d] = l.match(/CLIPE (\S+) (\S+) (\S+)/);
      return `<video id="v${n}" class="clip tela" style="position: absolute; left: 0px; top: 0px; width: 760px; height: 1646px; object-fit: cover" src="assets/clips/${nome}.mp4" muted playsinline data-start="${ini}" data-duration="${d}" data-track-index="1"></video>`;
    })
    .join("\n        ");
  const camadas = html.filter((l) => !l.startsWith("<!--CLIPE")).join("\n      ");

  // Celular entra no começo de cada bloco de app e sai no fim (com pausa só entre blocos não contíguos).
  const blocos = [];
  for (const [a, b] of fasesCelular) {
    const ult = blocos[blocos.length - 1];
    if (ult && Math.abs(ult[1] - a) < 0.01) ult[1] = b;
    else blocos.push([a, b]);
  }
  const animCel = blocos.flatMap(([a, b]) => [
    `tl.fromTo("#phone", { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${r2(Math.max(0, a - 0.15))});`,
    `tl.to("#phone", { y: 160, opacity: 0, duration: 0.35, ease: "power2.in" }, ${r2(b - 0.3)});`,
  ]);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>${v.titulo} — vídeo para WhatsApp</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #0f2a4a; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Geist", sans-serif; color: #f8fafc; }
      .fundo { position: absolute; inset: 0; background: radial-gradient(1100px 900px at 85% 0%, rgba(45, 212, 191, 0.22), transparent 60%), radial-gradient(900px 800px at 0% 100%, rgba(232, 176, 75, 0.14), transparent 60%), linear-gradient(180deg, #0f2a4a 0%, #0b1f38 100%); }
      .hl { color: #2dd4bf; }
      .head { position: absolute; left: 70px; right: 70px; top: 110px; height: 250px; display: flex; align-items: center; }
      .head h1 { font-size: 74px; line-height: 1.12; font-weight: 700; letter-spacing: -0.02em; }
      #phone { position: absolute; left: 160px; top: 400px; width: 760px; height: 1645px; border-radius: 72px; overflow: hidden; background: #f5f6f8; box-shadow: 0 0 0 14px #08182b, 0 40px 120px rgba(0, 0, 0, 0.55); }
      .tela { position: absolute; left: 0; top: 0; width: 760px; height: 1646px; object-fit: cover; }
      .chip-wrap { position: absolute; left: 0; right: 0; top: 400px; height: 0; display: flex; justify-content: center; }
      .chip { margin-top: -46px; height: 92px; padding: 0 44px; border-radius: 46px; background: #e8b04b; color: #0f2a4a; font-size: 50px; font-weight: 700; display: flex; align-items: center; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); }
      .center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 80px; }
      .center .inner { width: 100%; }
      .big { font-size: 96px; line-height: 1.08; font-weight: 750; letter-spacing: -0.03em; }
      .dores { list-style: none; margin-top: 70px; display: flex; flex-direction: column; gap: 26px; }
      .dores li { font-size: 50px; font-weight: 500; color: #e2e8f0; display: flex; align-items: center; gap: 22px; }
      .dores.x li::before { content: "✕"; width: 64px; height: 64px; flex: none; border-radius: 50%; background: rgba(248, 113, 113, 0.18); color: #f87171; font-size: 34px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .fim .inner { display: flex; flex-direction: column; align-items: center; text-align: center; }
      .logo { width: 260px; height: 140px; display: block; }
      .produto { margin-top: 40px; font-size: 104px; font-weight: 750; letter-spacing: -0.03em; }
      .frase { margin-top: 26px; font-size: 52px; line-height: 1.25; color: #cbd5e1; max-width: 900px; }
      .botao { margin-top: 80px; padding: 34px 80px; border-radius: 999px; background: #2dd4bf; color: #0f2a4a; font-size: 58px; font-weight: 750; }
      .site { margin-top: 48px; font-size: 54px; font-weight: 600; color: #e8b04b; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${id}" data-start="0" data-width="1080" data-height="1920" data-duration="${total}">
      <div id="bg" class="clip fundo" data-start="0" data-duration="${total}" data-track-index="0"></div>
      <div id="phone" data-layout-allow-overflow>
        ${videos}
      </div>
      ${camadas}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      gsap.set("#phone", { opacity: 0, y: 160 });
      ${[...animCel, ...anim].join("\n      ")}
      window.__timelines["${id}"] = tl;
    </script>
  </body>
</html>
`;
}

// Um projeto HyperFrames por vídeo (o render aceita uma composição raiz por projeto); cada um leva só os clipes que usa.
for (const [id, v] of Object.entries(VIDEOS)) {
  mkdirSync(`${id}/assets/clips`, { recursive: true });
  mkdirSync(`${id}/assets/fonts`, { recursive: true });
  cpSync("assets/fonts", `${id}/assets/fonts`, { recursive: true });
  for (const c of v.cenas) for (const [nome] of c.clipes ?? []) cpSync(`assets/clips/${nome}.mp4`, `${id}/assets/clips/${nome}.mp4`);
  for (const f of ["hyperframes.json", "package.json"]) cpSync(f, `${id}/${f}`);
  writeFileSync(`${id}/meta.json`, JSON.stringify({ id: `elo-${id}`, name: v.titulo }, null, 2));
  writeFileSync(`${id}/index.html`, gerar(id, v));
  console.log(id, "ok");
}
