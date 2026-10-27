// Gera a nota fiscal fictícia usada na gravação da captura por IA, com o mesmo desenho dos comprovantes da demo.
import { writeFileSync } from "node:fs";
import { comprovanteSvg } from "file:///C:/Users/jntra/projetos/mello-travasso/scripts/demo/recibo.ts";

const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const url = comprovanteSvg({
  titulo: "NOTA FISCAL",
  emissor: "Casa do Construtor Materiais",
  numero: "004817",
  data: hoje,
  linhas: [
    { descricao: "40 sc · Cimento CP II 50 kg", valor: 1560 },
    { descricao: "12 m³ · Areia média lavada", valor: 1440 },
    { descricao: "6 m³ · Brita 1", valor: 690 },
  ],
  total: 3690,
});
const svg = decodeURIComponent(url.replace(/^data:image\/svg\+xml(;charset=utf-8)?,/, ""));
writeFileSync(process.argv[2], svg.startsWith("<") ? svg : Buffer.from(url.split(",")[1], "base64").toString("utf8"));
console.log("ok", url.slice(0, 40));
