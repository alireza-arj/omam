import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "../theme";

export type DividerProps = {
  /** Inset to the start of the text, iOS-style, when the row has a leading icon. */
  inset?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ inset = 0, vertical = false, style }: DividerProps) {
  const colors = useColors();

  return (
    <View
      style={[
        vertical
          ? { width: StyleSheet.hairlineWidth, alignSelf: "stretch" }
          : { height: StyleSheet.hairlineWidth, marginStart: inset },
        { backgroundColor: colors.lineHairline },
        style,
      ]}
    />
  );
}
