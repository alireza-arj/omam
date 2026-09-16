import { type StyleProp, type ViewStyle } from "react-native";
import { Separator } from "heroui-native/separator";

export type DividerProps = {
  inset?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ inset = 0, vertical = false, style }: DividerProps) {
  return <Separator orientation={vertical ? "vertical" : "horizontal"} style={[{ marginStart: inset }, style]} />;
}
