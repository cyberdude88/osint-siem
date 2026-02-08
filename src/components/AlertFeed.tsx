import type { Alert } from "@/types/alert";
import {
  severityBg,
  severityLabel,
  categoryLabels,
  categoryOrder,
  categoryBadge,
  freshnessLabel,
} from "@/lib/severity";
import { ExternalLink, Clock, Building2 } from "lucide-react";

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AlertFeed({ alerts, selectedId, onSelect }: Props) {
  const sorted = [...alerts].sort((a, b) => {
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
      <div className="px-4 py-3 border-b border-siem-border">
        <h2 className="text-sm font-bold uppercase tracking-wider text-siem-muted">
          Alert Feed
        </h2>
        <p className="text-xs text-siem-muted mt-0.5">
          {alerts.length} authority bulletins
        </p>
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
                  <div className="flex items-center gap-3 text-[11px] text-siem-muted">
                    <span className="flex items-center gap-1">
                      <Building2 size={10} />
                      {alert.source.authority_name}
                    </span>
                    <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {freshnessLabel(alert.freshness_hours)}
                </span>
                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">
                      {categoryLabels[alert.category]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
