import type { Severity, AlertCategory } from "@/types/alert";

export const severityColors: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#06b6d4",
};

export const severityBg: Record<Severity, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  info: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export const categoryLabels: Record<AlertCategory, string> = {
  missing_person: "Missing Person",
  wanted_suspect: "Wanted Suspect",
  public_appeal: "Public Appeal",
  cyber_advisory: "Cyber Advisory",
  terrorism_tip: "Terrorism Tip",
  fraud_alert: "Fraud Alert",
  public_safety: "Public Safety",
};

export const categoryOrder: AlertCategory[] = [
  "cyber_advisory",
  "wanted_suspect",
  "missing_person",
  "public_appeal",
  "fraud_alert",
  "public_safety",
  "terrorism_tip",
];

export const categoryBadge: Record<AlertCategory, string> = {
  cyber_advisory: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  wanted_suspect: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  missing_person: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  public_appeal: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  fraud_alert: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  public_safety: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  terrorism_tip: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const categoryIcons: Record<AlertCategory, string> = {
  missing_person: "UserSearch",
  wanted_suspect: "ShieldAlert",
  public_appeal: "Megaphone",
  cyber_advisory: "ShieldCheck",
  terrorism_tip: "AlertTriangle",
  fraud_alert: "BadgeDollarSign",
  public_safety: "Siren",
};

export function freshnessLabel(hours: number): string {
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  if (hours < 168) return `${Math.round(hours / 24)}d ago`;
  return `${Math.round(hours / 168)}w ago`;
}

export function freshnessConfidence(hours: number): { label: string; color: string } {
  if (hours < 6) return { label: "FRESH", color: "text-green-400" };
  if (hours < 24) return { label: "RECENT", color: "text-yellow-400" };
  if (hours < 72) return { label: "AGING", color: "text-orange-400" };
  return { label: "STALE", color: "text-red-400" };
}
