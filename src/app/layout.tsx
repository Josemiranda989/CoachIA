import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://coachia.jmlabs.app"),
  title: {
    default: "CoachIA",
    template: "%s · CoachIA",
  },
  description: "Plataforma personal de entrenamiento de ciclismo y gym con IA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoachIA",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "CoachIA",
    description: "Plataforma personal de entrenamiento de ciclismo y gym con IA",
    url: "/",
    siteName: "CoachIA",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "CoachIA" }],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CoachIA",
    description: "Plataforma personal de entrenamiento de ciclismo y gym con IA",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-bg-main text-text-primary min-h-screen">
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <Script id="sw-register" strategy="beforeInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}
        </Script>
        <Providers>
          <Header />
          <main id="main" className="pb-20 md:pb-0">
            <PageTransition>{children}</PageTransition>
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
