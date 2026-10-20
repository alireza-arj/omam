import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Easing } from "react-native-reanimated";
import { Tabs } from "heroui-native/tabs";
import { useLanguage } from "../i18n";
import { layout, motion, typeRolesByLanguage } from "../tokens";

const indicatorTiming = {
  type: "timing" as const,
  config: {
    duration: motion.durFast,
    easing: Easing.bezier(motion.easeInOut.x1, motion.easeInOut.y1, motion.easeInOut.x2, motion.easeInOut.y2),
  },
};

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: (active: boolean) => ReactNode;
};
export type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: NoInfer<T>) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({
  options, value, onChange, size = "md", disabled = false, full = false, style,
}: SegmentedControlProps<T>) {
  const { language, direction } = useLanguage();
  return (
    <Tabs
      // Triggers report their position through onLayout, which react-native-web
      // only fires on a size change. A direction flip moves them without
      // resizing, so the indicator would keep the old side; remount instead.
      key={direction}
      value={value}
      onValueChange={(next) => {
        const option = options.find((entry) => entry.value === next);
        if (!disabled && option) onChange(option.value);
      }}
      style={[{ alignSelf: full ? "stretch" : "flex-start" }, style]}
    >
      <Tabs.List style={full ? { width: "100%" } : undefined}>
        <Tabs.Indicator animation={{ width: indicatorTiming, height: indicatorTiming, translateX: indicatorTiming }} />
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            isDisabled={disabled}
            style={{ flex: full ? 1 : undefined, minHeight: size === "sm" ? layout.controlMd : layout.tapMin, paddingHorizontal: layout.padControlX, gap: layout.gapTight }}
          >
            {option.icon?.(option.value === value)}
            <Tabs.Label style={typeRolesByLanguage[language][size === "lg" ? "button" : "label"]}>{option.label}</Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
