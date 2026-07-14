// ============================================================
// Shared TypeScript types for OpenBF6Tracker
// ============================================================

export type Platform = "origin" | "steam" | "psn" | "xbox";

export interface PlayerSearchResult {
  platformId: number;
  name: string;
  platform: Platform;
  avatar?: string;
  userId?: string;
}

export interface StatValue {
  value: number;
  displayValue: string;
  displayType: "Number" | "TimeSeconds" | "NumberPrecision2" | "NumberPercentage" | "Ratio" | "Percentage";
  category?: string;
}

export interface Segment {
  type: string;
  attributes?: Record<string, unknown>;
  metadata?: {
    name?: string;
    imageUrl?: string;
    category?: string;
    [key: string]: unknown;
  };
  stats: Record<string, StatValue>;
  expiryDate?: string;
}

export interface TrnProfile {
  platformId: number;
  platformUserId: string;
  platformUserHandle: string;
  platformUserIdentifier: string;
  avatarUrl?: string;
  additionalParameters?: Record<string, unknown>;
  segments: Segment[];
  expiryDate?: string;
}

export interface TrnMatch {
  id: string;
  metadata: {
    mapName?: string;
    mapImageUrl?: string;
    modeName?: string;
    duration?: number;
    endTimestamp?: number;
    result?: "win" | "loss" | "draw";
    [key: string]: unknown;
  };
  segments: Segment[];
}

export interface DeltaInfo {
  fromHash: string | null;
  toHash: string;
  isFirstSeen: boolean;
  isChanged: boolean;
}

export interface MatchesResponse {
  matches: TrnMatch[];
  totalCount: number;
}

// ============================================================
// Sponsor Visual Premium System (姓名颜色系统)
// ============================================================

export type SponsorLevel = "owner" | "contributor" | "tier1" | "tier2" | "tier3" | "tier4" | "none";

export interface SponsorInfo {
  level: SponsorLevel;
  color: string;
  cssClass: string;
  badge?: string;
  label: string;
}

export const SPONSOR_LEVELS: Record<SponsorLevel, SponsorInfo> = {
  owner: {
    level: "owner",
    color: "#ff6b6b",
    cssClass: "sponsor-owner",
    badge: "&#9733;",
    label: "Site Owner",
  },
  contributor: {
    level: "contributor",
    color: "#748ffc",
    cssClass: "sponsor-contributor",
    badge: "&#9824;",
    label: "Contributor",
  },
  tier1: {
    level: "tier1",
    color: "#fcc419",
    cssClass: "sponsor-tier1",
    badge: "&#9830;",
    label: "Sponsor Tier 1",
  },
  tier2: {
    level: "tier2",
    color: "#ff922b",
    cssClass: "sponsor-tier2",
    badge: "&#9830;",
    label: "Sponsor Tier 2",
  },
  tier3: {
    level: "tier3",
    color: "#4c6ef5",
    cssClass: "sponsor-tier3",
    badge: "",
    label: "Sponsor Tier 3",
  },
  tier4: {
    level: "tier4",
    color: "#20c997",
    cssClass: "sponsor-tier4",
    badge: "",
    label: "Sponsor Tier 4",
  },
  none: {
    level: "none",
    color: "",
    cssClass: "",
    badge: "",
    label: "",
  },
};

export interface SponsorEntry {
  id: string;
  platformUserId: string;
  name: string;
  level: SponsorLevel;
  activatedAt: string;
}

// ============================================================
// Mark Credibility Levels (标记可信度)
// ============================================================

export type CredibilityLevel = "confirmed" | "hack_sus" | "community";

export const CREDIBILITY_LEVELS: { id: CredibilityLevel; label: string; labelZh: string; color: string; bg: string }[] = [
  { id: "confirmed", label: "Confirmed", labelZh: "实锤", color: "#e03131", bg: "#fff5f5" },
  { id: "hack_sus", label: "Hack Sus", labelZh: "可疑", color: "#f08c00", bg: "#fff9db" },
  { id: "community", label: "Community", labelZh: "社区", color: "#495057", bg: "#f8f9fa" },
];

// ============================================================
// Suspicion / Community Marking types
// ============================================================

export type SuspicionType =
  | "aimbot"
  | "wallhack"
  | "dma"
  | "macro"
  | "recoil"
  | "converter"
  | "toxic";

export const SUSPICION_TYPES: { id: SuspicionType; label: string; color: string }[] = [
  { id: "aimbot", label: "Aimbot", color: "#e03131" },
  { id: "wallhack", label: "Wallhack", color: "#f08c00" },
  { id: "dma", label: "DMA", color: "#9c36b5" },
  { id: "macro", label: "Macro", color: "#2f9e44" },
  { id: "recoil", label: "Recoil", color: "#1971c2" },
  { id: "converter", label: "Converter", color: "#e8590c" },
  { id: "toxic", label: "Toxic", color: "#495057" },
];

export interface SuspicionReport {
  id: string;
  target: string;
  reporterKey: string;
  reportDate: string;
  types: SuspicionType[];
  credibility?: CredibilityLevel;
  createdAt: string;
}

export interface SuspicionSummary {
  playerId: string;
  totalReports: number;
  uniqueReporters: number;
  typeBreakdown: Record<SuspicionType, number>;
  credibilityBreakdown: Record<CredibilityLevel, number>;
  viewerMarkedToday: boolean;
  viewerReportTypes: SuspicionType[];
}

export interface TopMarkedPlayer {
  playerId: string;
  playerName: string;
  playerLevel: number;
  avatarUrl?: string;
  totalMarks: number;
  typeBreakdown: Record<SuspicionType, number>;
  credibility: CredibilityLevel;
}

// ============================================================
// Service status (enhanced)
// ============================================================

export interface ServiceStatus {
  frontend: "healthy" | "degraded" | "down";
  backendMain: "healthy" | "degraded" | "down";
  backendFailover: "healthy" | "degraded" | "down";
  gtStats: "healthy" | "degraded" | "down";
  gtProfile: "healthy" | "degraded" | "down";
  gtSearch: "healthy" | "degraded" | "down";
  backupSource: "healthy" | "degraded" | "down";
  database: "healthy" | "degraded" | "down";
  lastChecked: string;
  latencyMs: number;
  updatedAt: string;
}

export interface TrackedCounts {
  playersTracked: number;
  matchesTracked: number;
  updatedAt: string;
}

// ============================================================
// Streamer
// ============================================================

export interface VerifiedStreamer {
  id: string;
  name: string;
  platformId: number;
  avatarUrl?: string;
  level: number;
  platforms: {
    type: "twitch" | "youtube" | "bilibili";
    url: string;
    label: string;
  }[];
  verifiedAt: string;
}

// ============================================================
// Versions
// ============================================================

export const APP_VERSION = "v0.5.0";
