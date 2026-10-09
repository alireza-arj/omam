import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Check, CircleAlert, Clock3, Info } from "lucide-react-native";
import { Toast, useToast as useHeroToast } from "heroui-native/toast";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, radius, typeRolesByLanguage } from "../tokens";
import { Icon } from "./icon";

export type ToastTone = "info" | "success" | "warning" | "error";
export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

function ToastContent({ title, description, tone }: Pick<ToastOptions, "title" | "description" | "tone">) {
  const { language, t, direction } = useLanguage();
  const colors = useColors();
  const roles = typeRolesByLanguage[language];
  const appearance = tone === "success"
    ? { glyph: Check, background: colors.successFill, foreground: colors.successText }
    : tone === "warning"
      ? { glyph: Clock3, background: colors.warningFill, foreground: colors.warningText }
      : tone === "error"
        ? { glyph: CircleAlert, background: colors.fillAccentSoft, foreground: colors.textAccent }
        : { glyph: Info, background: colors.infoFill, foreground: colors.infoText };
  return (
    <View style={{ flexDirection: "row", direction, gap: layout.gapDefault, alignItems: "center" }}>
      <View style={{ alignItems: "center", justifyContent: "center", width: layout.tapMin, height: layout.tapMin, borderRadius: radius.full, backgroundColor: appearance.background }}>
        <Icon glyph={appearance.glyph} color={appearance.foreground} size={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Toast.Title style={roles.label}>{title}</Toast.Title>
        {description ? <Toast.Description style={roles.caption}>{description}</Toast.Description> : null}
      </View>
      <Toast.Close aria-label={t("common.close")} accessibilityLabel={t("common.close")} />
    </View>
  );
}

export function useToast() {
  const { toast } = useHeroToast();
  const showToast = useCallback(({ title, description, tone = "info", duration = 4500 }: ToastOptions) => {
    toast.show({
      duration: duration === 0 ? "persistent" : duration,
      component: (props) => (
        <Toast {...props} placement="top" variant={tone === "error" ? "danger" : tone === "info" ? "default" : tone}>
          <ToastContent title={title} description={description} tone={tone} />
        </Toast>
      ),
    });
  }, [toast]);

  return useMemo(() => ({ showToast, dismissToast: toast.hide }), [showToast, toast.hide]);
}
