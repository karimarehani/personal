import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue Chili · Déplacements & frais",
  description: "Missions, remboursements et récupérations pour Karima, Wijdane, Samir et Reda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
