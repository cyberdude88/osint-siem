import type { Alert } from "@/types/alert";
import { Shield, AlertTriangle, Globe, Radio, Clock } from "lucide-react";

interface Props {
  alerts: Alert[];
}

export function StatsBar({ alerts }: Props) {
  const total = alerts.length;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const high = alerts.filter((a) => a.severity === "high").length;
  const active = alerts.filter((a) => a.status === "active").length;
  const regions = new Set(alerts.map((a) => a.source.country_code)).size;
  const agencyTypes = new Set(alerts.map((a) => a.source.authority_type)).size;

  const stats = [
    { icon: Radio, label: "ACTIVE ALERTS", value: active, color: "text-green-400" },
    { icon: AlertTriangle, label: "CRITICAL", value: critical, color: "text-red-400" },
    { icon: Shield, label: "HIGH", value: high, color: "text-orange-400" },
    { icon: Globe, label: "REGIONS", value: regions, color: "text-blue-400" },
    { icon: Shield, label: "AGENCY TYPES", value: agencyTypes, color: "text-siem-muted" },
    { icon: Clock, label: "TOTAL", value: total, color: "text-siem-muted" },
  ];

  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-siem-panel border-b border-siem-border">
      <div className="flex items-center gap-2 mr-4">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-wider text-siem-muted">
          Live
        </span>
      </div>
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <s.icon size={14} className={s.color} />
          <div className="text-xs">
            <span className={`font-bold font-mono ${s.color}`}>{s.value}</span>
            <span className="text-siem-muted ml-1">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
