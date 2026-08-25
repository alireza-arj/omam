import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useTheme } from "../theme";
import { radius } from "../tokens";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: (active: boolean) => ReactNode;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  /** NoInfer keeps T pinned to `options`/`value` — a handler typed for a
   *  narrower union must not widen T to plain `string`. */
  onChange: (next: NoInfer<T>) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHTS = { sm: 26, md: 32, lg: 40 } as const;

/** The selected segment is a raised card on a quiet track — no accent fill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  disabled = false,
  full = false,
  style,
}: SegmentedControlProps<T>) {
  const { colors, elevation } = useTheme();

  return (
    <View
      style={[
        {
          alignSelf: full ? "stretch" : "flex-start",
          backgroundColor: colors.fillQuiet,
          borderRadius: radius.control,
          flexDirection: "row",
          gap: 2,
          opacity: disabled ? 0.4 : 1,
          padding: 2,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value as NoInfer<T>)}
            style={[
              {
                alignItems: "center",
                borderRadius: radius.control - 2,
                flexDirection: "row",
                flex: full ? 1 : undefined,
                gap: 5,
                height: HEIGHTS[size],
                justifyContent: "center",
                paddingHorizontal: 12,
              },
              active ? { backgroundColor: colors.surfaceCard } : null,
              active ? elevation(1) : null,
            ]}
          >
            {option.icon?.(active)}
            <Text role="label" tone={active ? "title" : "muted"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
