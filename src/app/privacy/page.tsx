"use client";

import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-surface-900 mb-8">{t("privacy.title")}</h1>

      <section className="prose prose-surface max-w-none">
        <p className="text-surface-600 leading-relaxed mb-6">{t("privacy.intro")}</p>

        <h2 className="text-xl font-semibold text-surface-800 mt-8 mb-3">{t("privacy.dataCollection")}</h2>
        <p className="text-surface-600 leading-relaxed">
          We collect only the minimum data necessary to provide our services: player game statistics
          (publicly available via GameTools API), community submission data (suspicion reports),
          and technical data required for site operation (cookies for language preference, recent searches).
          We do not collect personal identifying information beyond what is voluntarily provided.
        </p>

        <h2 className="text-xl font-semibold text-surface-800 mt-8 mb-3">{t("privacy.dataUsage")}</h2>
        <p className="text-surface-600 leading-relaxed">
          Game statistics are used solely to display player career summaries on the website.
          Community suspicion reports are aggregated and displayed publicly to help identify
          potential cheaters. We do not sell, rent, or share your data with third parties for
          marketing purposes.
        </p>

        <h2 className="text-xl font-semibold text-surface-800 mt-8 mb-3">{t("privacy.thirdParty")}</h2>
        <p className="text-surface-600 leading-relaxed">
          We use the GameTools Network API (api.gametools.network) to fetch publicly available
          Battlefield 6 player statistics. We may use Google Analytics for anonymized traffic
          analysis (opt-in via cookie consent). We do not embed third-party trackers without
          your consent.
        </p>

        <h2 className="text-xl font-semibold text-surface-800 mt-8 mb-3">{t("privacy.rights")}</h2>
        <p className="text-surface-600 leading-relaxed">
          You have the right to access, correct, or delete any personal data we hold. For
          community suspicion reports, you may appeal false marks via our contact form.
          Cookie preferences can be managed at any time through our cookie settings.
          Contact us via the Contact page for any privacy-related requests.
        </p>
      </section>
    </div>
  );
}
