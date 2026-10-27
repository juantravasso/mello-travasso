// Renderiza a nota fictícia em PNG, faz login uma vez (salva a sessão) e sonda o fluxo de captura sem confirmar.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const cred = readFileSync("C:/Users/jntra/projetos/mello-travasso/.demo-credenciais.txt", "utf8");
const [, email, senha] = cred.match(/DONO\s+.+?\s(\S+@\S+)\s+(\S+)/);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });

// Nota em PNG, levemente inclinada sobre uma mesa, para parecer foto de celular.
const p0 = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
const svg = readFileSync("nota.svg", "utf8");
await p0.setContent(`<body style="margin:0;background:radial-gradient(circle at 40% 30%,#8a7a66,#4a3f33);display:grid;place-items:center;height:1200px"><div style="transform:rotate(-3deg);box-shadow:0 30px 60px rgba(0,0,0,.45);width:780px">${svg.replace("<svg ", '<svg style="width:780px;height:auto;display:block" ')}</div></body>`);
await p0.screenshot({ path: "nota.jpg", type: "jpeg", quality: 88 });
await p0.close();

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', senha);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
await ctx.storageState({ path: "sessao.json" });

await page.goto(`${BASE}/capturar`, { waitUntil: "networkidle" });
const inputs = await page.$$eval('input[type="file"]', (els) => els.map((e) => `${e.getAttribute("accept")} capture=${e.getAttribute("capture")} id=${e.id}`));
console.log("file inputs:", inputs);
const t0 = Date.now();
await page.locator('input[type="file"]:not([capture])').first().setInputFiles("nota.jpg");
await page.waitForTimeout(1500);
console.log("após upload:", (await page.locator("main").innerText()).slice(0, 600));
await page.getByRole("button", { name: "Usar esta foto" }).click();
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const t = await page.locator("main").innerText();
  if (i % 5 === 0) console.log(`t+${i}s:`, t.replace(/\s+/g, " ").slice(0, 160));
  if (page.url().includes("/contas") || (await page.locator("main input:not([type=file])").count()) > 2) break;
}
console.log("IA levou", Date.now() - t0, "ms");
await page.screenshot({ path: "explorar/captura-revisao.png" });
const itens = await page.$$eval("main button, main input, main select, main textarea", (els) => els.map((e) => `${e.tagName.toLowerCase()} «${(e.innerText || e.value || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 60)}»`));
console.log(itens.join("\n"));
writeFileSync("explorar/captura-revisao.txt", await page.locator("main").innerText());
await browser.close();
