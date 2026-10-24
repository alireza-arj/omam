import { useState } from "react";
import { Modal, Platform, View } from "react-native";
import { Dialog } from "heroui-native/dialog";
import { useSync } from "../providers/sync-provider";
import { isDesktop } from "../lib/desktop";
import { formatClock } from "../lib/format";
import { Button, Card, Text, layout, typeRolesByLanguage, useLanguage } from "../design/taraz";

export function SessionConflicts() {
  const { conflicts, resolveConflict, isResolvingConflict } = useSync();
  const { t, language, direction } = useLanguage();
  const [open, setOpen] = useState(false);
  if (isDesktop() || !conflicts.length) return null;
  const conflict = conflicts[0];
  const close = () => { if (!isResolvingConflict) setOpen(false); };
  const content = <>
    <Dialog.Overlay isCloseOnPress={!isResolvingConflict} />
    <Dialog.Content isSwipeable={false} style={{ direction, gap: layout.gapDefault, width: "100%", maxWidth: layout.dialogMaxWidth, alignSelf: "center" }}>
      <Dialog.Title style={typeRolesByLanguage[language].title2}>{t("desktop.conflictTitle")}</Dialog.Title>
      <Dialog.Description style={typeRolesByLanguage[language].bodySm}>{t("desktop.conflictHint")}</Dialog.Description>
      {conflict.sessions.map((session) => <Card key={session.id} style={{ gap: layout.gapTight }}>
        <Text role="bodySm">{session.deviceName || t("desktop.unknownDevice")}</Text>
        <Text role="mono">{formatClock(session.startAt)}{session.endAt ? ` – ${formatClock(session.endAt)}` : ""}</Text>
        <Button label={t("desktop.keep")} disabled={isResolvingConflict} onPress={() => { void resolveConflict(conflict, session.id).then(() => setOpen(false)).catch(() => {}); }} />
      </Card>)}
      <Button label={t("desktop.later")} variant="ghost" disabled={isResolvingConflict} onPress={close} />
    </Dialog.Content>
  </>;
  return <>
    <Card style={{ margin: layout.padPage, gap: layout.gapTight }}><Text role="bodySm">{t("desktop.conflictTitle")}</Text><Button label={t("desktop.conflictTitle")} variant="quiet" onPress={() => setOpen(true)} /></Card>
    <Dialog isOpen={open} onOpenChange={(next) => { if (!isResolvingConflict) setOpen(next); }}>
      {Platform.OS === "web" ? <Modal visible={open} transparent onRequestClose={close}><View style={{ flex: 1, justifyContent: "center", padding: layout.padPage, direction }}>{content}</View></Modal> : <Dialog.Portal>{content}</Dialog.Portal>}
    </Dialog>
  </>;
}
