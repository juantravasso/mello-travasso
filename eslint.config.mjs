import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // O padrão "carregar dados no mount via useEffect + useState" usado nos
      // hooks de src/hooks é intencional enquanto a camada de dados é local
      // (services/data). Ao trocar por um backend real, considerar SWR/React
      // Query, que tornam esta regra desnecessária.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Acesso ao Prisma só nas Server Actions e no DAL de auth — em qualquer
    // outro arquivo é sinal de que uma query está sendo escrita fora do lugar
    // que já aplica exigirSessao()/empresaId (ver Fase 2 do PRD multiempresa).
    ignores: ["src/services/data/server/**", "src/lib/auth/**", "src/lib/prisma.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message: "Prisma só pode ser importado em src/services/data/server/*Actions.ts ou src/lib/auth/*.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
