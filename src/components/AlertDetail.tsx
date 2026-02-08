import type { Alert } from "@/types/alert";
import {
  severityBg,
  severityLabel,
  categoryLabels,
  freshnessLabel,
} from "@/lib/severity";
import {
  ExternalLink,
  Clock,
  Building2,
  MapPin,
  Shield,
  Radio,
  X,
  Phone,
} from "lucide-react";

interface Props {
  alert: Alert | null;
  onClose: () => void;
}

export function AlertDetail({ alert, onClose }: Props) {
  if (!alert) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-siem-border flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-siem-muted">
          Alert Detail
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-siem-accent/12 hover:text-siem-accent text-siem-muted transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Severity + Status */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border ${
              severityBg[alert.severity]
            }`}
          >
            {severityLabel[alert.severity]}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-white/5 text-siem-muted border border-siem-border">
            <Radio size={10} />
            {alert.status.toUpperCase()}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-siem-text">
          {alert.title}
        </h3>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
            <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
              Authority
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Building2 size={12} className="text-siem-neutral" />
              {alert.source.authority_name}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
            <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
              Country
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin size={12} className="text-siem-neutral" />
              {alert.source.country}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
            <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
              Category
            </div>
            <div className="text-sm">{categoryLabels[alert.category]}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
            <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
              First Seen
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Clock size={12} className="text-siem-neutral" />
              {freshnessLabel(alert.freshness_hours)}
            </div>
          </div>
        </div>

        {/* Authority Type */}
        <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
          <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
            Authority Type
          </div>
          <div className="text-sm capitalize">
            {alert.source.authority_type.replace("_", " ")}
          </div>
        </div>

        {/* Notice Age */}
        <div className="bg-white/5 rounded-lg p-3 border border-siem-border">
          <div className="text-[10px] uppercase tracking-wider text-siem-muted mb-1">
            Notice Age
          </div>
          <div className="text-sm font-mono font-bold text-siem-text">
            {freshnessLabel(alert.freshness_hours)}
          </div>
          <div className="text-[11px] text-siem-muted mt-1">
            Last confirmed: {freshnessLabel(
              (Date.now() - new Date(alert.last_seen).getTime()) / 3600000
            )}
          </div>
        </div>

        {/* Go To Alert */}
        <a
          href={alert.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-siem-accent hover:bg-siem-accent/80 text-white font-bold text-sm rounded-lg transition-colors"
        >
          <ExternalLink size={16} />
          GO TO OFFICIAL ALERT
        </a>

        <p className="text-[10px] text-siem-muted text-center leading-relaxed">
          This link opens the official authority bulletin.
          <br />
          No content is stored on this platform.
        </p>

        {alert.reporting && (
          <div className="bg-white/5 rounded-lg p-3 border border-siem-border space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-siem-muted">
              Report / Tip
            </div>
            <div className="text-sm text-siem-text font-semibold">
              {alert.reporting.label}
            </div>
            {alert.reporting.url && (
              <a
                href={alert.reporting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-siem-accent/10 hover:bg-siem-accent/20 text-siem-text text-xs rounded-lg transition-colors"
              >
                <ExternalLink size={14} />
                REPORT ONLINE
              </a>
            )}
            {alert.reporting.phone && (
              <div className="flex items-center gap-2 text-xs text-siem-muted">
                <Phone size={12} />
                {alert.reporting.phone}
              </div>
            )}
            {alert.reporting.notes && (
              <div className="text-[10px] text-siem-muted leading-relaxed">
                {alert.reporting.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
