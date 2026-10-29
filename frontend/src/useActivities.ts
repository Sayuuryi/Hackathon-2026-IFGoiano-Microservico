import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ActivityMonitor } from "./activities";
export function useActivities(enabled: boolean) {
  const monitor = useMemo(() => new ActivityMonitor(), []);
  const status = useSyncExternalStore(monitor.subscribe, monitor.snapshot);
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      if (document.visibilityState !== "hidden") void monitor.checkAll();
    };
    check();
    const timer = setInterval(check, 6000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, monitor]);
  return { status, refresh: monitor.check, offline: monitor.offline };
}
