import { Shield, Globe } from "lucide-react";

export function Header() {
  return (
    <div className="flex items-center justify-between px-6 py-2.5 bg-siem-panel border-b border-siem-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-siem-accent/20 border border-siem-accent/30">
          <Shield size={16} className="text-siem-accent" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide">
            OSINT SIEM
          </h1>
          <p className="text-[10px] text-siem-muted uppercase tracking-widest">
            Global Authority Bulletin Intelligence
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-siem-muted">
          <Globe size={12} />
          <span className="font-mono">ALL REGIONS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-mono uppercase">
            Monitoring
          </span>
        </div>
      </div>
    </div>
  );
}
