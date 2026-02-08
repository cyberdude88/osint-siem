import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { GlobeView } from "@/components/GlobeView";
import { AlertFeed } from "@/components/AlertFeed";
import { AlertDetail } from "@/components/AlertDetail";
import { useAlerts } from "@/hooks/useAlerts";

export default function App() {
  const { alerts, isLive, isLoading, sourceCount } = useAlerts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAlert = selectedId
    ? alerts.find((a) => a.alert_id === selectedId) ?? null
    : null;

  useEffect(() => {
    if (selectedId && !alerts.some((a) => a.alert_id === selectedId)) {
      setSelectedId(null);
    }
  }, [alerts, selectedId]);

  return (
    <div className="flex flex-col h-screen bg-siem-bg">
      {/* Top Bar */}
      <Header />
      <StatsBar alerts={alerts} />

      {/* Main Content: 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel: Alert Feed */}
        <div className="w-[340px] min-w-[300px] border-r border-siem-border bg-siem-panel flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-siem-muted text-sm">
              Loading live feed...
            </div>
          ) : (
            <AlertFeed
              alerts={alerts}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Center: Globe */}
        <div className="flex-1 relative bg-siem-bg">
          <GlobeView
            alerts={alerts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Right Panel: Alert Detail */}
        <div className="w-[360px] min-w-[320px] border-l border-siem-border bg-siem-panel flex flex-col">
          <AlertDetail
            alert={selectedAlert}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-6 py-1.5 bg-siem-panel border-t border-siem-border text-[10px] text-siem-muted font-mono">
        <span>OSINT SIEM v0.1.0 // Authority-Driven Cyber Situational Awareness</span>
        <span>
          Sources: {sourceCount} authorities // Live feed // No data stored // Index + Link only
        </span>
      </div>
    </div>
  );
}
