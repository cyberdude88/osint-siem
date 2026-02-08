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

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 relative">
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

        {/* Center: Globe (full remaining width) */}
        <div className="flex-1 relative bg-siem-bg">
          <GlobeView
            alerts={alerts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Right Panel: Slide-out Alert Detail */}
        {selectedAlert && (
          <div className="absolute top-0 right-0 h-full z-20 flex">
            {/* Backdrop click to close */}
            <div
              className="w-8 cursor-pointer bg-gradient-to-r from-transparent to-black/30"
              onClick={() => setSelectedId(null)}
            />
            <div className="w-[380px] bg-siem-panel border-l border-siem-border flex flex-col shadow-2xl shadow-black/50 animate-slide-in">
              <AlertDetail
                alert={selectedAlert}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}
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
