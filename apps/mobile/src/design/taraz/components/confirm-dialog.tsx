import { Modal, Pressable, View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";
import { useTranslation } from "../i18n";
import { useTheme } from "../theme";
import { layout, radius } from "../tokens";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Crimson confirm, for anything that destroys data. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * `Alert.alert` with buttons never renders on web, so a confirmation there
 * silently did nothing. This is a real modal — same behaviour everywhere.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors, elevation } = useTheme();
  const t = useTranslation();
  const confirm = confirmLabel ?? t("common.confirm");
  const cancel = cancelLabel ?? t("common.cancel");

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel={cancel}
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceScrim,
          flex: 1,
          justifyContent: "center",
          padding: layout.padPage,
        }}
      >
        {/* Swallows the press so a tap inside the card does not dismiss it. */}
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={[
            {
              backgroundColor: colors.surfaceCard,
              borderRadius: radius.sheet,
              gap: layout.gapLoose,
              maxWidth: 420,
              padding: layout.padSection,
              width: "100%",
            },
            elevation(4),
          ]}
        >
          <View style={{ gap: layout.gapTight }}>
            <Text role="title2">{title}</Text>
            {description ? (
              <Text role="bodySm" tone="muted">
                {description}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
            <Button
              label={cancel}
              variant="quiet"
              size="lg"
              disabled={loading}
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label={confirm}
              variant={destructive ? "primary" : "secondary"}
              size="lg"
              loading={loading}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
