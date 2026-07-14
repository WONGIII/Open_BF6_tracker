import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "OpenBF6Tracker - Battlefield 6 Player Stats & Community Anti-Cheat",
  description: "Track player stats, view career summaries, and participate in community-driven anti-cheat marking for Battlefield 6.",
  keywords: ["Battlefield 6", "BF6", "tracker", "stats", "anti-cheat", "community", "EA", "Origin", "Steam"],
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.gametools.network" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href="/favicon.png" sizes="any" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
