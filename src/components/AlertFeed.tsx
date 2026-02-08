import { useMemo, useState } from "react";
import type { Alert } from "@/types/alert";
import {
  severityBg,
  severityLabel,
  categoryLabels,
  categoryOrder,
  categoryBadge,
  freshnessLabel,
} from "@/lib/severity";
import { Clock, Building2, ChevronDown, Globe } from "lucide-react";

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  regionFilter: string;
  onRegionChange: (region: string) => void;
}

export function AlertFeed({
  alerts,
  selectedId,
  onSelect,
  regionFilter,
  onRegionChange,
}: Props) {
  const [actionableOnly, setActionableOnly] = useState(true);

  const regions = useMemo(() => {
    const set = new Map<string, number>();
    alerts.forEach((a) => {
      const r = a.source.region;
      set.set(r, (set.get(r) ?? 0) + 1);
    });
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const filtered =
    regionFilter === "all"
      ? alerts
      : alerts.filter((a) => a.source.region === regionFilter);

  const actionable = actionableOnly
    ? filtered.filter((a) => a.reporting?.url || a.reporting?.phone)
    : filtered;

  const infoAlerts = actionable.filter((a) => a.severity === "info");
  const primaryAlerts = actionable.filter((a) => a.severity !== "info");

  const sorted = [...primaryAlerts].sort((a, b) => {
    const sev = ["critical", "high", "medium", "low", "info"];
    const diff = sev.indexOf(a.severity) - sev.indexOf(b.severity);
    if (diff !== 0) return diff;
    return new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime();
  });

  const grouped = categoryOrder
    .map((category) => ({
      category,
      alerts: sorted.filter((alert) => alert.category === category),
    }))
    .filter((group) => group.alerts.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-siem-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-siem-muted">
            Alert Feed
          </h2>
          <span className="text-[10px] text-siem-muted font-mono">
            {actionable.length}/{alerts.length}
          </span>
        </div>
        {/* Region Filter Dropdown */}
        <div className="relative">
          <Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-siem-muted pointer-events-none" />
          <select
            value={regionFilter}
            onChange={(e) => onRegionChange(e.target.value)}
            className="w-full appearance-none bg-white/5 border border-siem-border rounded-md pl-7 pr-8 py-1.5 text-xs text-siem-text cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-siem-accent"
          >
            <option value="all">All Regions ({alerts.length})</option>
            {regions.map(([region, count]) => (
              <option key={region} value={region}>
                {region} ({count})
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-siem-muted pointer-events-none" />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-siem-muted">
          <input
            type="checkbox"
            checked={actionableOnly}
            onChange={(e) => setActionableOnly(e.target.checked)}
            className="accent-siem-accent"
          />
          Actionable only (reporting links)
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="px-4 py-2 sticky top-0 bg-siem-panel/95 backdrop-blur border-b border-siem-border">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${categoryBadge[group.category]}`}
              >
                {categoryLabels[group.category]}
              </span>
            </div>
            {group.alerts.map((alert) => {
              const isSelected = selectedId === alert.alert_id;
              return (
                <button
                  key={alert.alert_id}
                  onClick={() => onSelect(alert.alert_id)}
                  className={`w-full text-left px-4 py-3 border-b border-siem-border transition-colors hover:bg-white/5 ${
                    isSelected ? "bg-siem-accent/10 border-l-2 border-l-siem-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                        severityBg[alert.severity]
                      }`}
                    >
                      {severityLabel[alert.severity]}
                    </span>
                  </div>
                  <p className="text-sm text-siem-text leading-snug line-clamp-2 mb-1.5">
                    {alert.title}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-siem-muted flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 size={10} />
                      {alert.source.authority_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {freshnessLabel(alert.freshness_hours)}
                    </span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-siem-accent/10 rounded text-[10px] text-siem-accent">
                      <Globe size={9} />
                      {alert.source.region}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
        {infoAlerts.length > 0 && (
          <div>
            <div className="px-4 py-2 sticky top-0 bg-siem-panel/95 backdrop-blur border-b border-siem-border">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                Informational / Traffic
              </span>
            </div>
            {infoAlerts.map((alert) => {
              const isSelected = selectedId === alert.alert_id;
              return (
                <button
                  key={alert.alert_id}
                  onClick={() => onSelect(alert.alert_id)}
                  className={`w-full text-left px-4 py-3 border-b border-siem-border transition-colors hover:bg-white/5 ${
                    isSelected ? "bg-siem-accent/10 border-l-2 border-l-siem-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                        severityBg[alert.severity]
                      }`}
                    >
                      {severityLabel[alert.severity]}
                    </span>
                  </div>
                  <p className="text-sm text-siem-text leading-snug line-clamp-2 mb-1.5">
                    {alert.title}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-siem-muted flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 size={10} />
                      {alert.source.authority_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {freshnessLabel(alert.freshness_hours)}
                    </span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-siem-accent/10 rounded text-[10px] text-siem-accent">
                      <Globe size={9} />
                      {alert.source.region}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
