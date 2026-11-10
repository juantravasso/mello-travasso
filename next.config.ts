import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O domínio abre a busca de profissionais (/rede) sem redirecionar: a URL continua sendo só o domínio, o que vale mais
  // para o Google do que um 308. A vitrine dos dois produtos, que era a página inicial, fica em /gestao.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/rede" }], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Câmera é usada em /capturar (CameraCapture); geolocalização,
          // microfone e outras APIs sensíveis não são usadas pelo app.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      // Service worker do push: nunca em cache (o navegador precisa ver a versão nova) e sempre como JavaScript.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      // Páginas cujo token fica na URL: nunca em cache nem em Referer (o cabeçalho vale mais que o meta).
      {
        source: "/(redefinir-senha|confirmar-email)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
