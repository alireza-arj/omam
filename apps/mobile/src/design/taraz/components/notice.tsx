import { type StyleProp, type ViewStyle } from "react-native";
import { Alert } from "heroui-native/alert";
import { useLanguage } from "../i18n";
import { typeRolesByLanguage } from "../tokens";

export type NoticeTone = "default" | "accent" | "success" | "warning" | "danger";

export type NoticeProps = {
  title: string;
  description?: string;
  tone?: NoticeTone;
  style?: StyleProp<ViewStyle>;
};

/** An inline status message — form errors, sync problems, permission states. */
export function Notice({ title, description, tone = "default", style }: NoticeProps) {
  const { language, direction } = useLanguage();
  const roles = typeRolesByLanguage[language];

  return (
    <Alert status={tone} style={[{ direction }, style]}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title style={roles.label}>{title}</Alert.Title>
        {description ? <Alert.Description style={roles.caption}>{description}</Alert.Description> : null}
      </Alert.Content>
    </Alert>
  );
}
