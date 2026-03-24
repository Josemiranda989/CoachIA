import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoachIA - Entreno",
  description: "Plataforma de entrenamiento ciclismo y gym con IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
