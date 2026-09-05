import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { typeRolesByLanguage, type ColorScheme, type TypeRole } from "../tokens";

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

const MONO_ROLES = new Set<TypeRole>(["mono", "monoLg", "monoDisplay"]);

/**
 * A timecode is a run of Latin digits joined by neutral characters. Given an
 * RTL base direction the neutrals take the paragraph's side and `09:00 – 17:00`
 * renders reversed, so numeric roles stay LTR and are pushed to the right edge
 * by alignment instead.
 */
function bidi(role: TypeRole, rtl: boolean): TextStyle {
  if (!rtl) {
    return { writingDirection: "ltr" };
  }

  return MONO_ROLES.has(role)
    ? { writingDirection: "ltr", textAlign: "right" }
    : { writingDirection: "rtl" };
}

/**
 * Every string in the app goes through here, so type roles and tones stay the
 * only vocabulary — no loose fontSize or hex colours in screens.
 */
export function Text({ role = "body", tone, color, style, ...rest }: TextProps) {
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const resolvedTone: Tone =
    tone ?? (role === "title1" || role === "title2" || role === "title3" || role === "display" ? "title" : "body");

  return (
    <RNText
      style={[
        typeRolesByLanguage[language][role],
        {
          color: color ?? colors[TONE_KEY[resolvedTone]],
          // Yoga mirrors the box; the text inside it still has to be told.
          ...bidi(role, isRtl),
        },
        style,
      ]}
      {...rest}
    />
  );
}
