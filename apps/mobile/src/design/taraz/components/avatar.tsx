import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useTheme } from "../theme";
import { fontFamily, radius } from "../tokens";

export type AvatarProps = {
  uri?: string | null;
  /** Falls back to initials — never a stock silhouette. */
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function initials(name?: string) {
  if (!name) {
    return "";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** One of only two perfect circles in the system (the other is the play button). */
export function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  const { colors, elevation } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: "center",
          backgroundColor: colors.surfaceSunken,
          borderRadius: radius.full,
          height: size,
          justifyContent: "center",
          overflow: "hidden",
          width: size,
        },
        elevation(0),
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ height: size, width: size }} resizeMode="cover" />
      ) : (
        <Text
          color={colors.textMuted}
          style={{
            fontFamily: fontFamily.display[600],
            fontSize: Math.round(size * 0.36),
            lineHeight: Math.round(size * 0.42),
            letterSpacing: -0.2,
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
