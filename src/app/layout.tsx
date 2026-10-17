import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MARCA, TEMPLATE_TITULO, TITULO_PADRAO } from "@/lib/marca";
import { urlDoSite } from "@/lib/rede/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite()),
  // As páginas informam só o próprio título; o sufixo "| Elo Negócios" vem do template.
  title: { default: TITULO_PADRAO, template: TEMPLATE_TITULO },
  description: MARCA.descricao,
  applicationName: MARCA.nome,
  openGraph: {
    type: "website",
    siteName: MARCA.nome,
    locale: "pt_BR",
    title: TITULO_PADRAO,
    description: MARCA.descricao,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0e14",
};

const SCRIPT_TEMA_INICIAL = `
try {
  var tema = window.localStorage.getItem("mello-travasso:tema");
  if (tema === "light") document.documentElement.setAttribute("data-theme", "light");
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, evitando um flash do tema errado. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
