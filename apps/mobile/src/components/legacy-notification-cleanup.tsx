import { useEffect } from "react";
import { clearLegacyNotifications } from "../lib/clear-legacy-notifications";

export function LegacyNotificationCleanup() {
  useEffect(() => {
    void clearLegacyNotifications().catch(() => {});
  }, []);

  return null;
}
