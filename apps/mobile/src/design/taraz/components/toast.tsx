import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Toast, useToast as useHeroToast } from "heroui-native/toast";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

export type ToastTone = "info" | "success" | "warning" | "error";
export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

function ToastContent({ title, description }: Pick<ToastOptions, "title" | "description">) {
  const { language, t, direction } = useLanguage();
  const roles = typeRolesByLanguage[language];
  return (
    <View style={{ flexDirection: "row", direction, gap: layout.gapDefault, alignItems: "center" }}>
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
          <ToastContent title={title} description={description} />
        </Toast>
      ),
    });
  }, [toast]);

  return useMemo(() => ({ showToast, dismissToast: toast.hide }), [showToast, toast.hide]);
}
