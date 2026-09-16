import type { ReactNode } from "react";
import { type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Button as HeroButton } from "heroui-native/button";
import { buttonVariants } from "./button";
import { layout, radius } from "../tokens";

export type IconButtonProps = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "quiet" | "ghost";
  size?: "sm" | "md" | "lg";
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  children, label, variant = "quiet", size = "md", round = false, disabled = false, style, ...rest
}: IconButtonProps) {
  return (
    <HeroButton
      {...rest}
      isIconOnly
      accessibilityLabel={label}
      isDisabled={disabled === true}
      variant={buttonVariants[variant]}
      size={size}
      style={[
        { minHeight: layout.tapMin, minWidth: layout.tapMin },
        round ? { borderRadius: radius.full } : null,
        style,
      ]}
    >
      {children}
    </HeroButton>
  );
}
