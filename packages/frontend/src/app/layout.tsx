import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SYNCHRO — System Calibration Deck",
  description:
    "Asymmetric multiplayer co-op puzzle game. 3 operators. 1 system. Spot the mismatch.",
  keywords: ["synchro", "multiplayer", "puzzle", "co-op", "calibration"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-mono selection:bg-emerald-500/30">
        {children}
      </body>
    </html>
  );
}
