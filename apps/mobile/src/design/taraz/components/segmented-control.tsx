import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Tabs } from "heroui-native/tabs";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

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
  const { language } = useLanguage();
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const option = options.find((entry) => entry.value === next);
        if (!disabled && option) onChange(option.value);
      }}
      style={[{ alignSelf: full ? "stretch" : "flex-start" }, style]}
    >
      <Tabs.List style={full ? { width: "100%" } : undefined}>
        <Tabs.Indicator />
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            isDisabled={disabled}
            style={{ flex: full ? 1 : undefined, minHeight: layout.tapMin, paddingHorizontal: layout.padControlX, gap: layout.gapTight }}
          >
            {option.icon?.(option.value === value)}
            <Tabs.Label style={typeRolesByLanguage[language][size === "lg" ? "body" : "label"]}>{option.label}</Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
