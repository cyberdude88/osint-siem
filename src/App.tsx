import { useState } from "react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { GlobeView } from "@/components/GlobeView";
import { AlertFeed } from "@/components/AlertFeed";
import { AlertDetail } from "@/components/AlertDetail";
import { mockAlerts } from "@/data/mock-alerts";

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAlert = selectedId
    ? mockAlerts.find((a) => a.alert_id === selectedId) ?? null
    : null;

  return (
    <div className="flex flex-col h-screen bg-siem-bg">
      {/* Top Bar */}
      <Header />
      <StatsBar alerts={mockAlerts} />

      {/* Main Content: 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel: Alert Feed */}
        <div className="w-[340px] min-w-[300px] border-r border-siem-border bg-siem-panel flex flex-col">
          <AlertFeed
            alerts={mockAlerts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Center: Globe */}
        <div className="flex-1 relative bg-siem-bg">
          <GlobeView
            alerts={mockAlerts}
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
        <span>Sources: {new Set(mockAlerts.map((a) => a.source_id)).size} authorities // No data stored // Index + Link only</span>
      </div>
    </div>
  );
}
