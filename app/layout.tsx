import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = 'https://www.appdamarei.com'
const ogImage = `${baseUrl}/api/og?nome=Marei&desc=Crie+sua+p%C3%A1gina+de+agendamentos+em+minutos`

export const metadata: Metadata = {
  title: "Marei — Agendamentos profissionais",
  description: "Crie sua página de agendamentos personalizada, receba pelo WhatsApp automático e gerencie seus clientes com facilidade.",
  metadataBase: new URL(baseUrl),
  openGraph: {
    title: "Marei — Agendamentos profissionais",
    description: "Crie sua página de agendamentos personalizada, receba pelo WhatsApp automático e gerencie seus clientes com facilidade.",
    url: baseUrl,
    siteName: "Marei",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Marei — Agendamentos profissionais" }],
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marei — Agendamentos profissionais",
    description: "Crie sua página de agendamentos personalizada, receba pelo WhatsApp automático e gerencie seus clientes com facilidade.",
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
