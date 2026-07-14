"use client";

const tiers = [
  { cls: "sponsor-name-owner", label: "站长", desc: "网站创建者和维护者" },
  { cls: "sponsor-name-tier1", label: "赞助 Tier 1", desc: "累计赞助超过 ¥999" },
  { cls: "sponsor-name-tier2", label: "赞助 Tier 2", desc: "累计赞助超过 ¥199" },
  { cls: "sponsor-name-tier3", label: "赞助 Tier 3", desc: "累计赞助超过 ¥19.99" },
  { cls: "sponsor-name-tier4", label: "赞助 Tier 4", desc: "累计赞助超过 ¥5" },
  { cls: "sponsor-name-contributor", label: "网站协助者", desc: "对本站开发或运营有协助" },
];

export default function DonatePage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f5f5f5]">
      <div className="max-w-[560px] mx-auto px-4 py-10">
        <h1 className="text-xl font-bold text-[#333] mb-2">玩家名字颜色说明</h1>
        <p className="text-sm text-[#888] mb-8">
          想要让你的名字在网站上显示特殊颜色？通过<a href="/contact" className="text-[#4c6ef5] hover:underline">联系我们</a>提交申请，管理员会手动处理。
        </p>

        <div className="space-y-2">
          {tiers.map((t) => (
            <div key={t.cls} className="card p-4 flex items-center gap-4">
              <div className="shrink-0 w-24 text-center">
                <span className={`${t.cls} text-base`}>WANGIII1I1</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#333]">{t.label}</div>
                <div className="text-[11px] text-[#999]">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 mt-8 bg-[#edf2ff] border-[#bac8ff] text-center">
          <p className="text-sm text-[#4c6ef5] mb-3">想要赞助？</p>
          <a href="/contact" className="btn-primary text-sm inline-flex">联系我们 &rarr;</a>
        </div>
      </div>
    </div>
  );
}
