"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@/lib/types";
import { useState, useEffect } from "react";

export default function Footer() {
  const { t } = useTranslation();
  const [showSponsorInfo, setShowSponsorInfo] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <footer className="bg-[#fafafa] border-t border-[#e8e8e8] mt-auto" style={{ minHeight: 80 }} />;

  return (
    <>
      <footer className="bg-[#fafafa] border-t border-[#e8e8e8] text-[#888] mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#666]">{mounted ? t("site.title") : "BF6 Tracker"}</span>
              <span className="text-[#bbb]">{APP_VERSION}</span>
              <span className="text-[#bbb]">&middot;</span>
              <span className="text-[#aaa]">Powered by <a href="https://xnnserver.dpdns.org/" target="_blank" rel="noopener" className="text-[#4c6ef5] hover:underline">WANG</a></span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/privacy" className="hover:text-[#4c6ef5] transition-colors">{t("footer.privacy")}</Link>
              <Link href="/cookies" className="hover:text-[#4c6ef5] transition-colors">{t("footer.cookies")}</Link>
              <Link href="/donate" className="hover:text-[#4c6ef5] transition-colors">{t("nav.donate")}</Link>
              <Link href="/contact" className="hover:text-[#4c6ef5] transition-colors">{t("nav.contact")}</Link>
              <button
                onClick={() => setShowSponsorInfo(true)}
                className="hover:text-[#4c6ef5] transition-colors"
              >
                玩家名字颜色说明
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-[#bbb] mt-3">{t("footer.copyright")}</p>
        </div>
      </footer>

      {/* Sponsor info modal */}
      {showSponsorInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSponsorInfo(false)}>
          <div className="card p-6 max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#333]">{t("donate.colorExplanation")}</h3>
              <button onClick={() => setShowSponsorInfo(false)} className="text-[#aaa] hover:text-[#333] text-lg leading-none">&times;</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="sponsor-name-owner text-base">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tierOwner")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tierOwnerDesc")}</p>

              <div className="flex items-center gap-3">
                <span className="sponsor-name-tier1 text-base">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tier1")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tier1Desc")}</p>

              <div className="flex items-center gap-3">
                <span className="sponsor-name-tier2">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tier2")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tier2Desc")}</p>

              <div className="flex items-center gap-3">
                <span className="sponsor-name-tier3">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tier3")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tier3Desc")}</p>

              <div className="flex items-center gap-3">
                <span className="sponsor-name-tier4">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tier4")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tier4Desc")}</p>

              <div className="flex items-center gap-3">
                <span className="sponsor-name-contributor">WANGIII1I1</span>
                <span className="text-[#666]">{t("donate.tierContributor")}</span>
              </div>
              <p className="text-[#aaa] text-xs ml-7">{t("donate.tierContributorDesc")}</p>
            </div>

            <button onClick={() => setShowSponsorInfo(false)} className="btn-outline w-full mt-5 text-sm py-2">
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
