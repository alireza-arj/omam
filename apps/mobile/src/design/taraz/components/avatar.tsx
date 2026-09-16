import { type StyleProp, type ViewStyle } from "react-native";
import { Avatar as HeroAvatar } from "heroui-native/avatar";
import { Text } from "./text";
import { layout } from "../tokens";

export type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function initials(name?: string) {
  return (name ?? "").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ uri, name, size = layout.tapMin, style }: AvatarProps) {
  return (
    <HeroAvatar alt={name ?? ""} style={[{ height: size, width: size }, style]}>
      {uri ? <HeroAvatar.Image source={{ uri }} /> : null}
      <HeroAvatar.Fallback>
        <Text role="title3" tone="muted">{initials(name)}</Text>
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
