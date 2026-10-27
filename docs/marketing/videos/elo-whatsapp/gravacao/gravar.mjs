// Grava cada fluxo do modo demo como um clipe separado, em tamanho de celular, com marcação de toque visível.
// Os tempos de cada passo vão para clips/marcas.json, para cortar a edição nos pontos certos.
// Uso: node gravar.mjs [nome-do-clipe ...]   (sem argumentos grava todos)
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const BASE = "http://localhost:3100";
const VIEW = { width: 390, height: 844 };
const OUT = "clips";
mkdirSync(OUT, { recursive: true });
const marcasArq = `${OUT}/marcas.json`;
const marcas = existsSync(marcasArq) ? JSON.parse(readFileSync(marcasArq, "utf8")) : {};

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });

// Esconde o indicador do Next em modo dev e desenha um círculo onde cada toque acontece.
const INIT = `
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important} html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none}";
    document.head.appendChild(s);
  });
  document.addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;border-radius:50%;" +
      "left:" + (e.clientX - 23) + "px;top:" + (e.clientY - 23) + "px;background:rgba(45,212,191,.35);border:2px solid rgba(15,118,110,.9)";
    document.documentElement.appendChild(d);
    d.animate([{ transform: "scale(.5)", opacity: 1 }, { transform: "scale(1.7)", opacity: 0 }], { duration: 650, easing: "ease-out" }).onfinish = () => d.remove();
  }, true);
`;

async function gravar(nome, logado, roteiro) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    storageState: logado ? "sessao.json" : undefined,
    recordVideo: { dir: `${OUT}/tmp-${nome}`, size: { width: 780, height: 1688 } },
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const goto0 = page.goto.bind(page);
  page.goto = async (url) => { await goto0(url, { waitUntil: "domcontentloaded", timeout: 90000 }); await page.locator("main").first().waitFor({ timeout: 60000 }); await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); await esperarConteudo(); };
  const esperarConteudo = () => page.waitForFunction(() => { const t = document.querySelector("main")?.innerText ?? ""; return t.length > 150 && !/Carregando|Salvando/.test(t); }, null, { timeout: 45000 }).then(() => page.waitForTimeout(400)).catch(() => console.log("conteúdo não carregou em", page.url()));
  const t0 = Date.now();
  const m = {};
  const marca = (rotulo) => (m[rotulo] = +((Date.now() - t0) / 1000).toFixed(2));
  const pausa = (ms) => page.waitForTimeout(ms);
  // Rolagem suave por um tempo fixo (o scroll nativo pularia direto).
  const rolar = (dy, ms = 2000) =>
    page.evaluate(
      ([dy, ms]) =>
        new Promise((ok) => {
          const y0 = scrollY, ini = performance.now();
          const passo = (t) => {
            const k = Math.min(1, (t - ini) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            scrollTo(0, y0 + dy * e);
            if (k < 1) requestAnimationFrame(passo);
            else ok();
          };
          requestAnimationFrame(passo);
        }),
      [dy, ms],
    );
  const mostrar = async (loc, ms = 1200) => {
    const y = await loc.evaluate((el) => el.getBoundingClientRect().top + scrollY - innerHeight / 2 + el.getBoundingClientRect().height / 2);
    await rolar(y - (await page.evaluate(() => scrollY)), ms);
  };
  const tocar = async (loc) => {
    await mostrar(loc, 700);
    await pausa(250);
    await loc.click();
  };
  try {
    await roteiro({ page, pausa, rolar, mostrar, tocar, marca, esperarConteudo });
    marca("fim");
  } catch (e) {
    console.log(`ERRO em ${nome}:`, e.message.split("\n")[0]);
    await page.screenshot({ path: `${OUT}/erro-${nome}.png` });
  }
  await ctx.close();
  const video = await page.video().path();
  renameSync(video, `${OUT}/${nome}.webm`);
  marcas[nome] = m;
  writeFileSync(marcasArq, JSON.stringify(marcas, null, 2));
  console.log("gravado", nome, m);
}

const CLIPES = {
  // Painel com totais, fluxo do mês, gastos por categoria e projetos.
  painel: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/dashboard`);
    marca("pronto");
    await pausa(1800);
    marca("rola1");
    await rolar(720, 2600);
    await pausa(1200);
    marca("rola2");
    await rolar(900, 2600);
    await pausa(1600);
  }],

  // Foto da nota → IA preenche → confirma.
  captura: [true, async ({ page, pausa, rolar, tocar, marca, esperarConteudo }) => {
    await page.goto(`${BASE}/capturar`);
    marca("pronto");
    await pausa(1500);
    marca("foto");
    await page.locator('input[type="file"]').first().setInputFiles("nota.jpg");
    await pausa(1600);
    await tocar(page.getByRole("button", { name: "Usar esta foto" }));
    marca("ia_inicio");
    await page.getByText(/Confiança da leitura/).waitFor({ timeout: 90000 });
    marca("ia_fim");
    await pausa(2200);
    await rolar(650, 2400);
    marca("itens");
    await pausa(1600);
    await rolar(900, 2000);
    await pausa(600);
    await tocar(page.getByRole("button", { name: "Confirmar e salvar" }));
    marca("salvando");
    await page.waitForFunction(() => !/Salvando/.test(document.body.innerText), null, { timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await esperarConteudo();
    marca("salvo");
    await pausa(2600);
  }],

  // Lista de contas → abre uma → dá baixa.
  baixa: [true, async ({ page, pausa, rolar, mostrar, tocar, marca, esperarConteudo }) => {
    await page.goto(`${BASE}/contas-a-pagar`);
    marca("pronto");
    await pausa(1500);
    await rolar(420, 1800);
    await pausa(700);
    await tocar(page.locator('a[href^="/contas-a-pagar/"]', { hasText: "Combustível" }).first());
    await page.waitForLoadState("networkidle");
    await esperarConteudo();
    marca("detalhe");
    await pausa(1500);
    const baixar = page.getByRole("button", { name: /Dar baixa/ });
    await tocar(baixar);
    marca("baixa");
    await pausa(900);
    const confirmar = page.getByRole("button", { name: /^(Confirmar|Dar baixa|Sim)/ }).last();
    if (await confirmar.isVisible().catch(() => false)) await tocar(confirmar);
    await page.waitForFunction(() => !/Salvando/.test(document.body.innerText), null, { timeout: 45000 });
    await esperarConteudo();
    marca("confirmado");
    await mostrar(page.getByText(/Baixad|Paga em|Pago/).first(), 900).catch(() => {});
    await pausa(2600);
  }],

  obra: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/obras`);
    const link = page.locator('a[href^="/obras/"]', { hasText: "Fachada Edifício" }).first();
    await page.goto(BASE + (await link.getAttribute("href")));
    marca("pronto");
    await pausa(1500);
    await rolar(800, 2600);
    await pausa(1500);
  }],

  calendario: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/calendario`);
    await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), null, { timeout: 30000 }).catch(() => {});
    await pausa(2500);
    marca("pronto");
    await pausa(1500);
    await rolar(620, 2200);
    await pausa(1500);
  }],

  estoque: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/estoque`);
    marca("pronto");
    await pausa(1400);
    await rolar(600, 2200);
    await pausa(1400);
  }],

  equipe: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/funcionarios`);
    marca("pronto");
    await pausa(1400);
    await rolar(400, 1800);
    await pausa(1400);
  }],

  // Quem contrata, sem login: categoria → resultados → perfil com avaliações.
  busca: [false, async ({ page, pausa, rolar, mostrar, tocar, marca, esperarConteudo }) => {
    await page.goto(`${BASE}/rede`);
    marca("pronto");
    await pausa(1500);
    await tocar(page.getByRole("link", { name: "Encanador", exact: true }));
    await page.waitForLoadState("networkidle");
    await esperarConteudo();
    marca("resultados");
    await pausa(700);
    const card = page.locator('a[href="/empresas/hidrocerto-encanamentos"]').first();
    await mostrar(card, 1600);
    await pausa(1000);
    await tocar(card);
    await page.waitForURL("**/empresas/hidrocerto-encanamentos", { timeout: 60000 });
    await page.getByRole("heading", { name: /HidroCerto/ }).first().waitFor({ timeout: 60000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForLoadState("networkidle");
    await esperarConteudo();
    await page.evaluate(() => scrollTo(0, 0));
    marca("perfil");
    await pausa(2000);
    await rolar(700, 2400);
    marca("avaliacoes");
    await pausa(1200);
    await rolar(700, 2400);
    await pausa(1600);
  }],

  // Lado do profissional: perfil publicado e a página pública que os clientes veem.
  meuperfil: [true, async ({ page, pausa, rolar, marca }) => {
    await page.goto(`${BASE}/minha-rede/perfil`);
    marca("pronto");
    await pausa(1800);
    await page.goto(`${BASE}/empresas/horizonte-reformas`);
    marca("publico");
    await pausa(1500);
    await rolar(750, 2600);
    await pausa(1000);
    await rolar(800, 2600);
    await pausa(1500);
  }],
};

// Aquece as rotas (o modo dev compila na primeira visita) para a gravação não pegar tela de carregamento.
const aquece = await browser.newContext({ storageState: "sessao.json" });
const pa = await aquece.newPage();
for (const r of ["/dashboard", "/capturar", "/contas-a-pagar", "/obras", "/calendario", "/estoque", "/funcionarios", "/rede", "/rede/buscar?profissao=encanador", "/empresas/hidrocerto-encanamentos", "/minha-rede/perfil", "/empresas/horizonte-reformas"])
  await pa.goto(BASE + r, { waitUntil: "load", timeout: 120000 }).catch((e) => console.log("aquecer", r, e.message.split("\n")[0]));
await aquece.close();

const nomes = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPES);
for (const n of nomes) await gravar(n, ...CLIPES[n]);
await browser.close();
