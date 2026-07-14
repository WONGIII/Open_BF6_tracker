"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { setCookie, getCookie } from "cookies-next";

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const pref = getCookie("bf6_cookie_consent");
    if (!pref) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = (analytics: boolean) => {
    setCookie("bf6_cookie_consent", analytics ? "all" : "essential", {
      maxAge: 365 * 24 * 60 * 60, path: "/", sameSite: "lax",
    });
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-white border-t border-[#e8e8e8] shadow-lg">
        <div className="max-w-[1200px] mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-[#888] max-w-xl leading-relaxed">
              {t("cookies.banner")}{" "}
              <a href="/cookies" className="text-[#4c6ef5] hover:underline">{t("cookies.preferences")}</a>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => accept(false)} className="btn-ghost text-xs px-3 py-1.5">
                {t("cookies.acceptEssential")}
              </button>
              <button onClick={() => accept(true)} className="btn-primary text-xs px-4 py-1.5">
                {t("cookies.acceptAll")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
