import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Pic — Comparte momentos en tiempo real",
  description: "La plataforma para compartir y proyectar fotos en tus eventos sociales. Sube fotos, dales like y disfruta la galería en pantalla grande.",
  keywords: "fotos eventos, galería tiempo real, compartir fotos, evento social",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="animated-bg" aria-hidden="true" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
