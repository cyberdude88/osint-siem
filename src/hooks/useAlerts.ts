import { useEffect, useMemo, useState } from "react";
import type { Alert } from "@/types/alert";
const ALERTS_URL = "/alerts.json";
const POLL_MS = 15000;

function normalizeAlerts(data: unknown): Alert[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const alerts = data.filter((item) => item && typeof item === "object") as Alert[];
  return alerts.length > 0 ? alerts : null;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`${ALERTS_URL}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`alerts fetch failed: ${response.status}`);
        }
        const data = (await response.json()) as unknown;
        const normalized = normalizeAlerts(data);
        if (!cancelled && normalized) {
          setAlerts(normalized);
          setIsLive(true);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLive(false);
          setIsLoading(false);
        }
      } finally {
        inFlight = false;
      }
    }

    load();
    const interval = setInterval(load, POLL_MS);
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const sourceCount = useMemo(() => new Set(alerts.map((a) => a.source_id)).size, [alerts]);

  return { alerts, isLive, isLoading, sourceCount };
}
