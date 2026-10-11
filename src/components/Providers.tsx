"use client";

import "@/lib/i18n";
import { SponsorProvider } from "@/components/SponsorContext";
import { AuthProvider } from "@/components/AuthContext";
import ThemeController from "@/components/ThemeController";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeController>
    <AuthProvider>
    <SponsorProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieBanner />
    </SponsorProvider>
    </AuthProvider>
    </ThemeController>
  );
}
