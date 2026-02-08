import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const knownAlertIdsRef = useRef<Set<string>>(new Set());
  const refreshTimeoutRef = useRef<number | null>(null);
  const glowTimeoutsRef = useRef<number[]>([]);

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

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      glowTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.alert_id));
    const previousIds = knownAlertIdsRef.current;
    const hasPreviousSnapshot = previousIds.size > 0;

    if (hasPreviousSnapshot) {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      setIsRefreshingList(true);
      refreshTimeoutRef.current = window.setTimeout(() => {
        setIsRefreshingList(false);
      }, 160);
    }

    const incoming = alerts
      .filter((a) => !previousIds.has(a.alert_id))
      .map((a) => a.alert_id);

    if (hasPreviousSnapshot && incoming.length > 0) {
      setNewAlertIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((id) => next.add(id));
        return next;
      });

      const clearId = window.setTimeout(() => {
        setNewAlertIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((id) => next.delete(id));
          return next;
        });
      }, 2200);
      glowTimeoutsRef.current.push(clearId);
    }

    knownAlertIdsRef.current = currentIds;
  }, [alerts]);

  const severityRail: Record<Alert["severity"], string> = {
    critical: "bg-red-300/80",
    high: "bg-orange-300/80",
    medium: "bg-amber-300/80",
    low: "bg-emerald-300/80",
    info: "bg-cyan-300/80",
  };

  const renderAlertCard = (alert: Alert, queueLabel: string, position: number) => {
    const isSelected = selectedId === alert.alert_id;
    const isNew = newAlertIds.has(alert.alert_id);

    return (
      <button
        key={alert.alert_id}
        onClick={() => onSelect(alert.alert_id)}
        className={`relative w-full text-left rounded-lg border border-siem-border px-3 py-2.5 pl-4 bg-siem-bg/45 transition-colors hover:bg-siem-accent/8 ${
          isSelected ? "bg-siem-accent/10 border-siem-accent/45" : ""
        } ${isNew ? "animate-alert-new-glow" : ""}`}
      >
        <span
          className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${severityRail[alert.severity]}`}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                severityBg[alert.severity]
              } ${alert.severity === "critical" ? "animate-critical-badge" : ""}`}
            >
              {severityLabel[alert.severity]}
            </span>
            {isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded border border-siem-accent/35 text-siem-accent bg-siem-accent/12">
                New
              </span>
            )}
          </div>
          <span className="text-[10px] text-siem-muted font-mono uppercase tracking-wider">
            {queueLabel} #{position + 1}
          </span>
        </div>
        <p className="text-sm text-siem-text leading-snug line-clamp-2 mb-2">{alert.title}</p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-siem-muted font-mono uppercase tracking-wide">
          <span className="flex items-center gap-1 min-w-0">
            <Building2 size={10} />
            <span className="truncate">{alert.source.authority_name}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock size={10} />
            {freshnessLabel(alert.freshness_hours)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-siem-accent/10 text-siem-accent border border-siem-accent/20">
            <Globe size={9} />
            {alert.source.region}
          </span>
          <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-white/5 text-siem-muted border border-siem-border">
            {alert.status}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-siem-border bg-siem-panel/95 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-siem-muted">
            SOC Triage Stack
          </h2>
          <span className="px-2 py-0.5 rounded border border-siem-accent/30 bg-siem-accent/12 text-[10px] text-siem-accent font-mono">
            {actionable.length} IN QUEUE
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-wide">
          <div className="rounded border border-siem-border bg-white/5 px-2 py-1">
            <span className="text-siem-muted">Active</span>{" "}
            <span className="text-siem-text">{alerts.filter((a) => a.status === "active").length}</span>
          </div>
          <div className="rounded border border-siem-border bg-white/5 px-2 py-1">
            <span className="text-siem-muted">Actionable</span>{" "}
            <span className="text-siem-text">
              {alerts.filter((a) => a.reporting?.url || a.reporting?.phone).length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-siem-muted pointer-events-none" />
            <select
              value={regionFilter}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-siem-border rounded-md pl-7 pr-8 py-1.5 text-xs text-siem-text cursor-pointer hover:bg-siem-accent/10 transition-colors focus:outline-none focus:ring-1 focus:ring-siem-accent"
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
          <button
            type="button"
            onClick={() => setActionableOnly((prev) => !prev)}
            className={`shrink-0 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              actionableOnly
                ? "bg-siem-accent/18 text-siem-accent border-siem-accent/35"
                : "bg-white/5 text-siem-muted border-siem-border hover:bg-siem-accent/10 hover:text-siem-accent"
            }`}
          >
            Actionable
          </button>
        </div>
      </div>
      <div
        className={`flex-1 overflow-y-auto px-3 py-3 space-y-3 ${
          isRefreshingList ? "animate-alert-list-refresh" : ""
        }`}
      >
        {grouped.map((group) => (
          <section
            key={group.category}
            className="rounded-lg border border-siem-border bg-siem-panel/35 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-siem-border bg-siem-panel/70">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${categoryBadge[group.category]}`}
              >
                {categoryLabels[group.category]}
              </span>
              <span className="text-[10px] text-siem-muted font-mono uppercase tracking-wide">
                {group.alerts.length}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {group.alerts.map((alert, idx) => renderAlertCard(alert, "Queue", idx))}
            </div>
          </section>
        ))}
        {infoAlerts.length > 0 && (
          <section className="rounded-lg border border-siem-border bg-siem-panel/35 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-siem-border bg-siem-panel/70">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                Informational / Traffic
              </span>
              <span className="text-[10px] text-siem-muted font-mono uppercase tracking-wide">
                {infoAlerts.length}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {infoAlerts.map((alert, idx) => renderAlertCard(alert, "Info", idx))}
            </div>
          </section>
        )}
        {actionable.length === 0 && (
          <div className="rounded-lg border border-siem-border bg-siem-panel/35 p-4 text-center">
            <p className="text-xs text-siem-muted uppercase tracking-wider">
              No alerts match current queue filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
