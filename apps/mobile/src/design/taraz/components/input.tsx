import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { Platform, type TextInputProps, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { TextField } from "heroui-native/text-field";
import { Input as HeroInput } from "heroui-native/input";
import { InputGroup } from "heroui-native/input-group";
import { TextArea } from "heroui-native/text-area";
import { Label } from "heroui-native/label";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Text } from "./text";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { LayoutDirection } from "uniwind";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { fontSize, layout, typeRolesByLanguage } from "../tokens";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  hint?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  freeText?: boolean;
};

export function Input({
  label, hint, error, size = "lg", leading, trailing, containerStyle, freeText = false, ...rest
}: InputProps) {
  const id = useId();
  const { isRtl, language, t } = useLanguage();
  const colors = useColors();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [prefixWidth, setPrefixWidth] = useState(0);
  const [suffixWidth, setSuffixWidth] = useState(0);
  const isPassword = rest.secureTextEntry === true;
  const suffix = isPassword ? (
    <>
      {trailing}
      <IconButton
        label={t(passwordVisible ? "auth.hidePassword" : "auth.showPassword")}
        variant="ghost"
        disabled={rest.editable === false}
        accessibilityState={{ selected: passwordVisible }}
        onPress={() => setPasswordVisible((visible) => !visible)}
      >
        <Icon glyph={passwordVisible ? EyeOff : Eye} size={layout.iconMd} color={colors.textMuted} />
      </IconButton>
    </>
  ) : trailing;
  const roles = typeRolesByLanguage[language];
  // Under Persian every field reads from the right. Codes, numbers and
  // passwords keep an LTR run so `09:00` and `hassan_dev` are not reordered,
  // while an empty field takes the paragraph's direction for its placeholder.
  const rtlRun = isRtl && (freeText || !rest.value);
  const inputStyle: TextStyle = {
    ...roles[size === "sm" ? "bodySm" : "body"],
    ...(Platform.OS === "web" ? { fontSize: fontSize.inputWebMin } : null),
    lineHeight: undefined,
    minHeight: size === "sm" ? layout.controlLg : layout.controlField,
    height: "auto",
    writingDirection: rtlRun ? "rtl" : "ltr",
    textAlign: isRtl ? "right" : "left",
    ...(rest.multiline ? { minHeight: layout.controlField * 2, textAlignVertical: "top", paddingVertical: layout.padControlX } : null),
  };
  // HeroUI pads the field with logical start/end, which react-native-web
  // resolves against its own (LTR) direction rather than the document's, so
  // under Persian the room for the eye button lands on the text's side.
  // Physical sides keyed to the language are right on every platform.
  const startPad = prefixWidth || layout.padControlX;
  const endPad = suffixWidth || layout.padControlX;
  const affixPadding: TextStyle = {
    paddingStart: undefined,
    paddingEnd: undefined,
    paddingLeft: isRtl ? endPad : startPad,
    paddingRight: isRtl ? startPad : endPad,
  };
  const inputProps = {
    ...rest,
    secureTextEntry: isPassword ? !passwordVisible : rest.secureTextEntry,
    nativeID: rest.nativeID ?? id,
    accessibilityLabel: rest.accessibilityLabel ?? label,
    "aria-describedby": error || hint ? id + "-description" : undefined,
    isInvalid: Boolean(error),
    style: inputStyle,
  };

  return (
    <TextField isInvalid={Boolean(error)} isDisabled={rest.editable === false} style={[{ width: "100%", gap: layout.gapTight }, containerStyle]}>
      {label ? <Label nativeID={id + "-label"}><Label.Text style={[roles.label, { color: colors.textBody }]}>{label}</Label.Text></Label> : null}
      {rest.multiline ? (
        <TextArea {...inputProps} />
      ) : leading || suffix ? (
        <LayoutDirection rtl={isRtl}>
          <InputGroup>
            {leading ? <InputGroup.Prefix onLayout={(event) => setPrefixWidth(event.nativeEvent.layout.width)}>{leading}</InputGroup.Prefix> : null}
            <InputGroup.Input {...inputProps} style={[inputStyle, affixPadding]} />
            {suffix ? <InputGroup.Suffix onLayout={(event) => setSuffixWidth(event.nativeEvent.layout.width)}>{suffix}</InputGroup.Suffix> : null}
          </InputGroup>
        </LayoutDirection>
      ) : <HeroInput {...inputProps} />}
      {error ? <FieldError nativeID={id + "-description"}><Text role="caption" tone="accent">{error}</Text></FieldError> : null}
      {!error && hint ? <Description nativeID={id + "-description"} style={[roles.caption, { color: colors.textMuted }]}>{hint}</Description> : null}
    </TextField>
  );
}
