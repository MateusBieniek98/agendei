import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GN — Gestão de Produção",
    template: "%s · GN",
  },
  description:
    "App de gestão de produção em silvicultura para a GN. Lançamentos diários, " +
    "controle de máquinas, metas e dashboards em tempo real.",
  applicationName: "GN Silvicultura",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f80ed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)]">
        {children}
      </body>
    </html>
  );
}
