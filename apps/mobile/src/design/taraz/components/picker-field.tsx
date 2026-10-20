import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Icon } from "./icon";
import { MotionReveal } from "./motion-reveal";
import { Text } from "./text";
import { useColors, useTheme } from "../theme";
import { layout, radius } from "../tokens";

export type PickerTriggerProps = {
  label: string;
  value: string;
  placeholder?: string;
  glyph: LucideIcon;
  /** Digits and timecodes keep an LTR run under Persian. */
  numeric?: boolean;
  open: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The closed state of a picker: looks like `Input`, opens a panel instead of a keyboard. */
export function PickerTrigger({ label, value, placeholder, glyph, numeric = false, open, onPress, style }: PickerTriggerProps) {
  const colors = useColors();

  return (
    <View style={[{ gap: layout.gapTight }, style]}>
      <Text role="label" tone="body">{label}</Text>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${value || placeholder || ""}`}
        onPress={onPress}
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceSunken,
          borderColor: open ? colors.lineAccent : colors.lineHairline,
          borderRadius: radius.lg,
          borderWidth: open ? 1 : layout.hairline,
          flexDirection: "row",
          gap: layout.gapDefault,
          minHeight: layout.controlField,
          paddingHorizontal: layout.padControlX,
        }}
      >
        <Text
          role="body"
          tone={value ? "title" : "faint"}
          numberOfLines={1}
          style={[{ flex: 1 }, numeric ? { writingDirection: "ltr" } : null]}
        >
          {value || placeholder}
        </Text>
        <Icon glyph={glyph} size={layout.iconMd} color={open ? colors.textAccent : colors.textMuted} />
      </PressableFeedback>
    </View>
  );
}

/**
 * The open state: a raised panel directly under the field, in the form's own
 * flow. No portal and no measured anchor, so it cannot drift or jump, and it
 * behaves the same on web and native.
 */
export function PickerPanel({ children }: { children: ReactNode }) {
  const colors = useColors();
  const { elevation } = useTheme();

  return (
    <MotionReveal
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.xl,
          gap: layout.gapDefault,
          padding: layout.padControlX,
        },
        elevation(2),
      ]}
    >
      {children}
    </MotionReveal>
  );
}
