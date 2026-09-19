import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PRODUCT_BRAND } from "@/lib/product-brand";

export const metadata: Metadata = {
  title: {
    default: PRODUCT_BRAND.name,
    template: `%s · ${PRODUCT_BRAND.shortName}`,
  },
  description:
    PRODUCT_BRAND.description,
  applicationName: PRODUCT_BRAND.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PRODUCT_BRAND.colors.pine },
    { media: "(prefers-color-scheme: dark)", color: "#101915" },
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
                var t = localStorage.getItem('forestry-ops:theme') || localStorage.getItem('gn-theme');
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
