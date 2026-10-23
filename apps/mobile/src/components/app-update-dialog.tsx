import { useState } from "react";
import { Platform } from "react-native";
import * as Updates from "expo-updates";
import { ConfirmDialog, useLanguage } from "../design/taraz";
import { useAuth } from "../providers/auth-provider";

export function AppUpdateDialog() {
  if (Platform.OS === "web" || !Updates.isEnabled) return null;
  return <NativeUpdateDialog />;
}

function NativeUpdateDialog() {
  const { t } = useLanguage();
  const { isReady } = useAuth();
  const { isUpdateAvailable, isUpdatePending, isDownloading, downloadError, availableUpdate, downloadedUpdate } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const update = isUpdatePending ? downloadedUpdate : availableUpdate;
  const promptKey = `${update?.type === Updates.UpdateInfoType.NEW ? update.updateId : "rollback"}:${isUpdatePending ? "ready" : "available"}`;
  const loading = busy || isDownloading;
  const hasError = failed || (!isUpdatePending && !!downloadError);

  async function confirm() {
    if (loading) return;
    setBusy(true);
    setFailed(false);
    try {
      if (isUpdatePending) {
        await Updates.reloadAsync();
      } else {
        await Updates.fetchUpdateAsync();
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      visible={isReady && (isUpdateAvailable || isUpdatePending) && dismissed !== promptKey}
      title={t(isUpdatePending ? "appUpdate.readyTitle" : "appUpdate.availableTitle")}
      description={t(hasError ? "appUpdate.failed" : isUpdatePending ? "appUpdate.readyDescription" : isDownloading ? "appUpdate.downloading" : "appUpdate.availableDescription")}
      confirmLabel={t(isUpdatePending ? "appUpdate.restart" : "appUpdate.download")}
      cancelLabel={t("appUpdate.later")}
      loading={loading}
      onConfirm={() => { void confirm(); }}
      onCancel={() => setDismissed(promptKey)}
    />
  );
}
