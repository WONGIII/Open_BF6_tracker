"use client";

import { useTranslation } from "react-i18next";

export default function SearchPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-surface-900 mb-6">{t("search.title")}</h1>
      <p className="text-surface-500 mb-8">
        Use the search box on the homepage to look up a player by EA ID, Steam ID, PSN ID, or Xbox Gamertag.
      </p>
      <a href="/" className="btn-primary">
        Back to Search
      </a>
    </div>
  );
}
