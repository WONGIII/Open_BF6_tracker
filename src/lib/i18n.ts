"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { getCookie, setCookie } from "cookies-next";

const COOKIE_NAME = "bf6_lang";

function detectLanguage(): string {
  // 1. Check cookie
  if (typeof window !== "undefined") {
    const saved = getCookie(COOKIE_NAME);
    if (saved && ["en", "zh"].includes(saved as string)) return saved as string;
  }
  // 2. Check system language
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
    if (lang.startsWith("zh")) return "zh";
  }
  return "en";
}

const initialLang = typeof window !== "undefined" ? detectLanguage() : "en";

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`@/locales/${language}/${namespace}.json`)
    )
  )
  .init({
    lng: initialLang,
    fallbackLng: "en",
    supportedLngs: ["en", "zh"],
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Save language to cookie on change
i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    setCookie(COOKIE_NAME, lng, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });
  }
});

export default i18n;
