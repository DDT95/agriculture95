import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas territorial du Val-d’Oise — DDT 95",
  description: "Dix observatoires cartographiques pour comprendre les territoires du Val-d’Oise.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
