import { useState, type ReactNode } from "react";
import {
  Platform,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useTheme } from "../theme";
import { layout, palette, radius, typeRoles } from "../tokens";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  hint?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

const HEIGHTS = { sm: layout.controlSm, md: layout.controlMd, lg: layout.controlLg } as const;

export function Input({
  label,
  hint,
  error,
  size = "lg",
  leading,
  trailing,
  containerStyle,
  ...rest
}: InputProps) {
  const { colors, elevation } = useTheme();
  const [focused, setFocused] = useState(false);

  // A multiline field grows instead of clipping to the control height, and its
  // affordances sit at the top rather than centred against three lines of text.
  const multiline = rest.multiline === true;
  const box: ViewStyle = multiline
    ? {
        alignItems: "flex-start",
        minHeight: HEIGHTS[size] * 2,
        paddingVertical: layout.padControlY,
      }
    : { alignItems: "center", height: HEIGHTS[size] };

  return (
    <View style={[{ gap: 5, width: "100%" }, containerStyle]}>
      {label ? (
        <Text role="label" tone="body">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          {
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.control,
            flexDirection: "row",
            gap: 7,
            paddingHorizontal: layout.padControlX,
          },
          box,
          elevation(1),
          error
            ? { borderColor: palette.accent600, borderWidth: 1 }
            : focused
              ? {
                  borderColor: palette.accent500,
                  borderWidth: 1,
                  shadowColor: palette.accent500,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.38,
                  shadowRadius: 4,
                }
              : null,
        ]}
      >
        {leading}
        <TextInput
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          placeholderTextColor={colors.textFaint}
          selectionColor={palette.accent500}
          style={[
            typeRoles.bodySm,
            {
              color: colors.textTitle,
              flex: 1,
              minWidth: 0,
              padding: 0,
              ...(multiline ? { textAlignVertical: "top" as const } : null),
              ...Platform.select({ web: { outlineStyle: "none" } as object }),
            },
          ]}
          {...rest}
        />
        {trailing}
      </View>

      {error || hint ? (
        <Text role="caption" tone={error ? "accent" : "muted"}>
          {error || hint}
        </Text>
      ) : null}
    </View>
  );
}
