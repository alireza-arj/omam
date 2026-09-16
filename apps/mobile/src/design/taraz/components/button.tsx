import type { ReactNode } from "react";
import { type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Button as HeroButton, type ButtonVariant as HeroButtonVariant } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, radius, typeRolesByLanguage } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  pill?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const buttonVariants: Record<ButtonVariant, HeroButtonVariant> = {
  primary: "primary", secondary: "secondary", quiet: "tertiary", ghost: "ghost", outline: "outline",
};

export function Button({
  label, variant = "primary", size = "md", full = false, pill = false,
  loading = false, disabled = false, icon, iconEnd, style, ...rest
}: ButtonProps) {
  const colors = useColors();
  const { language } = useLanguage();

  return (
    <HeroButton
      {...rest}
      variant={buttonVariants[variant]}
      size={size}
      isDisabled={disabled === true || loading}
      accessibilityState={{ ...rest.accessibilityState, disabled: disabled === true || loading, busy: loading }}
      style={[
        { alignSelf: full ? "stretch" : "flex-start", minHeight: layout.tapMin, height: "auto" },
        pill ? { borderRadius: radius.pill } : null,
        style,
      ]}
    >
      {loading ? <Spinner size="sm" color={variant === "primary" ? colors.textOnAccent : colors.textTitle} /> : icon}
      <HeroButton.Label style={typeRolesByLanguage[language][size === "lg" ? "body" : "label"]}>
        {label}
      </HeroButton.Label>
      {iconEnd}
    </HeroButton>
  );
}
