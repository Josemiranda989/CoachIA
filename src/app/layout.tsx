import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoachIA - Entreno",
  description: "Plataforma de entrenamiento ciclismo y gym con IA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoachIA",
  },
  formatDetection: {
    telephone: false,
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
        <Script id="sw-register" strategy="beforeInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}
        </Script>
        <Providers>
          <Header />
          <main className="pb-20 md:pb-0">
            <PageTransition>{children}</PageTransition>
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
