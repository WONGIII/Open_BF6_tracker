"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TrackedCounts } from "@/lib/types";

interface ServiceGroup {
  label: string;
  items: { key: string; name: string }[];
}

export default function StatusPage() {
  const { t } = useTranslation();
  const [services, setServices] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<TrackedCounts>({ playersTracked: 0, matchesTracked: 0, updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [s, c] = await Promise.all([
          fetch("/api/status").then((r) => r.json()),
          fetch("/api/status/counts").then((r) => r.json()),
        ]);
        setServices(s);
        setCounts(c);
        setLatency(s.latencyMs || 0);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const serviceGroups: ServiceGroup[] = [
    {
      label: t("status.backendServices"),
      items: [
        { key: "backend", name: "HK" },
      ],
    },
    {
      label: "GameTools " + t("status.dataSource"),
      items: [
        { key: "gtStats", name: "GT " + t("status.stats") },
        { key: "gtProfile", name: "GT " + t("status.profile") },
        { key: "gtSearch", name: "GT " + t("status.search") },
      ],
    },
  ];

  const allHealthy = Object.values(services).every((s) => s === "healthy");

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f5f5f5]">
      <div className="max-w-[640px] mx-auto px-4 py-10">
        <h1 className="text-xl font-bold text-[#333] mb-2">{t("status.title")}</h1>

        {allHealthy && !loading ? (
          <div className="flex items-center gap-2 text-[#51cf66] mb-6">
            <span className="w-2 h-2 rounded-full bg-[#51cf66] animate-pulse-slow" />
            <span className="text-xs font-medium">{t("status.allHealthy")}</span>
          </div>
        ) : (
          <p className="text-[#ffa94d] text-xs mb-6">{t("status.degraded")}</p>
        )}

        <div className="space-y-3 mb-6">
          {serviceGroups.map((group) => (
            <div key={group.label} className="card p-4">
              <h3 className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">{group.label}</h3>
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-xs text-[#666]">{item.name}</span>
                    <StatusBadge status={services[item.key]} t={t} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {latency > 0 && (
          <p className="text-[11px] text-[#bbb] text-right mb-6">
            {t("status.latency")}: {latency}ms
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <div className="text-xl font-bold text-[#4c6ef5]">{counts.playersTracked.toLocaleString()}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{t("home.stats.trackedPlayers")}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xl font-bold text-[#4c6ef5]">{counts.matchesTracked.toLocaleString()}</div>
            <div className="text-[11px] text-[#999] mt-0.5">{t("home.stats.matchesRecorded")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status?: string; t: (key: string) => string }) {
  const dots: Record<string, string> = {
    healthy: "status-dot-healthy",
    degraded: "status-dot-unknown",
    down: "status-dot-down",
    unknown: "status-dot-unknown",
  };

  const colors: Record<string, string> = {
    healthy: "bg-[#d3f9d8] text-[#2b8a3e]",
    degraded: "bg-[#fff3bf] text-[#e67700]",
    down: "bg-[#ffe3e3] text-[#c92a2a]",
    unknown: "bg-[#fff3bf] text-[#e67700]",
  };

  const labels: Record<string, string> = {
    healthy: t("status.healthy"),
    degraded: t("status.degraded"),
    down: t("status.down"),
    unknown: "...",
  };

  const s = status || "unknown";

  return (
    <span className={`badge text-[10px] ${colors[s]} flex items-center gap-1.5`}>
      <span className={`status-dot ${dots[s]}`} />
      {labels[s]}
    </span>
  );
}
