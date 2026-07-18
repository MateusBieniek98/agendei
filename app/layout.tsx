import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#343b8f" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f141b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Script inline: tema + registro do service worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('gn-theme');
                if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    registration.update().catch(function(){});
                  }).catch(function(){});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
