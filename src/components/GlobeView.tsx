import { useEffect, useRef, useCallback } from "react";
import Globe from "react-globe.gl";
import type { Alert } from "@/types/alert";
import { severityColors } from "@/lib/severity";

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function GlobeView({ alerts, selectedId, onSelect }: Props) {
  const globeRef = useRef<any>(null);

  useEffect(() => {
    if (!globeRef.current) return;
    const globe = globeRef.current;

    // Dark styling
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.3;
    globe.controls().enableZoom = true;

    // Point camera to show nice angle
    globe.pointOfView({ lat: 30, lng: 0, altitude: 2.2 }, 0);
  }, []);

  // When an alert is selected, fly to it
  useEffect(() => {
    if (!globeRef.current || !selectedId) return;
    const alert = alerts.find((a) => a.alert_id === selectedId);
    if (alert) {
      globeRef.current.pointOfView(
        { lat: alert.lat, lng: alert.lng, altitude: 1.5 },
        800
      );
      // Pause rotation briefly
      globeRef.current.controls().autoRotate = false;
      setTimeout(() => {
        if (globeRef.current) {
          globeRef.current.controls().autoRotate = true;
          globeRef.current.controls().autoRotateSpeed = 0.15;
        }
      }, 5000);
    }
  }, [selectedId, alerts]);

  const pointData = alerts.map((a) => ({
    lat: a.lat,
    lng: a.lng,
    size: a.severity === "critical" ? 0.6 : a.severity === "high" ? 0.45 : 0.3,
    color: severityColors[a.severity],
    id: a.alert_id,
    label: `${a.source.authority_name}: ${a.title.substring(0, 60)}...`,
  }));

  const ringsData = alerts
    .filter((a) => a.severity === "critical" || a.freshness_hours < 12)
    .map((a) => ({
      lat: a.lat,
      lng: a.lng,
      maxR: a.severity === "critical" ? 4 : 2,
      propagationSpeed: a.severity === "critical" ? 2 : 1,
      repeatPeriod: a.severity === "critical" ? 800 : 1200,
      color: () => severityColors[a.severity],
    }));

  const handlePointClick = useCallback(
    (point: any) => {
      if (point.id) onSelect(point.id);
    },
    [onSelect]
  );

  return (
    <div className="w-full h-full relative">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        // Points
        pointsData={pointData}
        pointAltitude={(d: any) => d.size * 0.05}
        pointRadius={(d: any) => d.size}
        pointColor={(d: any) => d.color}
        pointLabel={(d: any) => d.label}
        onPointClick={handlePointClick}
        // Pulse rings for critical/fresh
        ringsData={ringsData}
        ringColor="color"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        // Atmosphere
        atmosphereColor="#3b82f6"
        atmosphereAltitude={0.15}
        // Performance
        animateIn={true}
        width={undefined}
        height={undefined}
      />
      {/* Overlay: region count */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4">
        {[
          { sev: "critical", color: "bg-red-500" },
          { sev: "high", color: "bg-orange-500" },
          { sev: "medium", color: "bg-yellow-500" },
          { sev: "low", color: "bg-green-500" },
        ].map(({ sev, color }) => (
          <div key={sev} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-siem-muted">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {sev}
          </div>
        ))}
      </div>
    </div>
  );
}
