"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getCookie, setCookie } from "cookies-next";

export default function CookiesPage() {
  const { t } = useTranslation();
  const [currentPref, setCurrentPref] = useState<string>("");
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const pref = getCookie("bf6_cookie_consent") as string;
    setCurrentPref(pref || "none");
    setAnalytics(pref === "all");
  }, []);

  const save = () => {
    const value = analytics ? "all" : "essential";
    setCookie("bf6_cookie_consent", value, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });
    setCurrentPref(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-surface-900 mb-8">{t("cookies.preferences")}</h1>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-surface-800 mb-2">{t("cookies.essential")}</h2>
          <p className="text-sm text-surface-500 mb-3">{t("cookies.essentialDesc")}</p>
          <span className="badge bg-green-100 text-green-700">Always Active</span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-surface-800">{t("cookies.analytics")}</h2>
            <button
              onClick={() => setAnalytics(!analytics)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                analytics ? "bg-primary-600" : "bg-surface-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  analytics ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-surface-500">{t("cookies.analyticsDesc")}</p>
        </div>

        <button onClick={save} className="btn-primary">
          {saved ? "Saved!" : "Save Preferences"}
        </button>

        {currentPref && (
          <p className="text-xs text-surface-400">
            Current setting: <strong>{currentPref === "all" ? "All cookies" : "Essential only"}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
