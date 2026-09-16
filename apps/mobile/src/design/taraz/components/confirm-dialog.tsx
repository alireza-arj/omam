import { Modal, Platform, StyleSheet, View } from "react-native";
import { Dialog } from "heroui-native/dialog";
import { Button } from "./button";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible, title, description, confirmLabel, cancelLabel,
  destructive = false, loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { t, language, direction } = useLanguage();
  const roles = typeRolesByLanguage[language];
  const cancel = () => { if (!loading) onCancel(); };
  const content = (
    <>
      <Dialog.Overlay isCloseOnPress={!loading} style={StyleSheet.absoluteFill} />
      <Dialog.Content
        isSwipeable={!loading && Platform.OS !== "web"}
        style={{ direction, gap: layout.gapLoose, maxWidth: layout.dialogMaxWidth, width: "100%", alignSelf: "center" }}
      >
        <Dialog.Title style={roles.title2}>{title}</Dialog.Title>
        {description ? <Dialog.Description style={roles.bodySm}>{description}</Dialog.Description> : null}
        <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
          <Button label={cancelLabel ?? t("common.cancel")} variant="quiet" size="lg" disabled={loading} onPress={cancel} style={{ flex: 1 }} />
          <Button label={confirmLabel ?? t("common.confirm")} variant={destructive ? "primary" : "secondary"} size="lg" loading={loading} onPress={onConfirm} style={{ flex: 1 }} />
        </View>
      </Dialog.Content>
    </>
  );

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => { if (!open) cancel(); }}>
      {Platform.OS === "web" ? (
        <Modal visible={visible} transparent onRequestClose={cancel}>
          <View style={{ flex: 1, justifyContent: "center", padding: layout.padPage, direction }}>
            {content}
          </View>
        </Modal>
      ) : <Dialog.Portal>{content}</Dialog.Portal>}
    </Dialog>
  );
}
