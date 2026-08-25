import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useColors } from "../theme";
import { typeRoles, type ColorScheme, type TypeRole } from "../tokens";

type Tone =
  | "title"
  | "body"
  | "muted"
  | "faint"
  | "accent"
  | "onAccent"
  | "onInverse"
  | "success"
  | "warning"
  | "info";

const TONE_KEY: Record<Tone, keyof ColorScheme> = {
  title: "textTitle",
  body: "textBody",
  muted: "textMuted",
  faint: "textFaint",
  accent: "textAccent",
  onAccent: "textOnAccent",
  onInverse: "textOnInverse",
  success: "successText",
  warning: "warningText",
  info: "infoText",
};

export type TextProps = Omit<RNTextProps, "role"> & {
  role?: TypeRole;
  tone?: Tone;
  /** Override the colour outright — for text over artwork or a filled surface. */
  color?: string;
};

/**
 * Every string in the app goes through here, so type roles and tones stay the
 * only vocabulary — no loose fontSize or hex colours in screens.
 */
export function Text({ role = "body", tone, color, style, ...rest }: TextProps) {
  const colors = useColors();
  const resolvedTone: Tone =
    tone ?? (role === "title1" || role === "title2" || role === "title3" || role === "display" ? "title" : "body");

  return (
    <RNText
      style={[typeRoles[role], { color: color ?? colors[TONE_KEY[resolvedTone]] }, style]}
      {...rest}
    />
  );
}
