import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
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
  title: "Synchro — a 3-player co-op puzzle",
  description:
    "Three players, three different screens, one hidden bug. Talk it out, find the line that doesn't match, and fix it before time runs out.",
  keywords: ["synchro", "multiplayer", "puzzle", "co-op", "debugging game"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-emerald-500/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
