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

  return (
    <>
      <footer className="bg-[#fafafa] border-t border-[#e8e8e8] text-[#888] mt-auto" suppressHydrationWarning>
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#666]">{mounted ? t("site.title") : "BF6 Tracker"}</span>
              <span className="text-[#bbb]">{APP_VERSION}</span>
              <span className="text-[#bbb]">&middot;</span>
              <span className="text-[#aaa]">Powered by <a href="https://xnnserver.dpdns.org/" target="_blank" rel="noopener" className="text-[#4c6ef5] hover:underline">WANG</a></span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/privacy" className="hover:text-[#4c6ef5]">隐私政策</Link>
              <Link href="/cookies" className="hover:text-[#4c6ef5]">Cookie 政策</Link>
              <Link href="/donate" className="hover:text-[#4c6ef5]">赞助</Link>
              <Link href="/contact" className="hover:text-[#4c6ef5]">联系我们</Link>
              <a href="https://github.com/WONGIII/Open_BF6_tracker" target="_blank" rel="noopener" className="hover:text-[#4c6ef5] flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                GitHub
              </a>
              <button onClick={() => setShowSponsorInfo(true)} className="hover:text-[#4c6ef5]">玩家名字颜色说明</button>
            </div>
          </div>
          <p className="text-center text-[11px] text-[#bbb] mt-3">OpenBF6Tracker 是社区项目。与 EA 或 DICE 无关联。</p>
        </div>
      </footer>
      {showSponsorInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSponsorInfo(false)}>
          <div className="card p-6 max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#333]">玩家名字颜色说明</h3>
              <button onClick={() => setShowSponsorInfo(false)} className="text-[#aaa] hover:text-[#333] text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3"><span className="sponsor-name-owner text-xl">WANGIII1I1</span><span className="text-[#666]">站长</span></div>
              <p className="text-[#aaa] text-xs ml-7">网站拥有者</p>
              <div className="flex items-center gap-3"><span className="sponsor-name-tier1 text-xl">WANGIII1I1</span><span className="text-[#666]">Tier 1 (¥999+)</span></div>
              <p className="text-[#aaa] text-xs ml-7">最高等级赞助者</p>
              <div className="flex items-center gap-3"><span className="sponsor-name-tier2 text-xl">WANGIII1I1</span><span className="text-[#666]">Tier 2 (¥199+)</span></div>
              <p className="text-[#aaa] text-xs ml-7">高级赞助者</p>
              <div className="flex items-center gap-3"><span className="sponsor-name-tier3 text-xl">WANGIII1I1</span><span className="text-[#666]">Tier 3 (¥19.99+)</span></div>
              <p className="text-[#aaa] text-xs ml-7">中级赞助者</p>
              <div className="flex items-center gap-3"><span className="sponsor-name-tier4 text-xl">WANGIII1I1</span><span className="text-[#666]">Tier 4 (¥5+)</span></div>
              <p className="text-[#aaa] text-xs ml-7">入门赞助者</p>
              <div className="flex items-center gap-3"><span className="sponsor-name-contributor text-xl">WANGIII1I1</span><span className="text-[#666]">协助者</span></div>
              <p className="text-[#aaa] text-xs ml-7">网站开发协助者</p>
            </div>
            <button onClick={() => setShowSponsorInfo(false)} className="btn-outline w-full mt-5 text-sm py-2">关闭</button>
          </div>
        </div>
      )}
    </>
  );
}
