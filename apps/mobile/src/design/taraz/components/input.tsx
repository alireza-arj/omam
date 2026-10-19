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
  const [passwordVisible, setPasswordVisible] = useState(false);
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
        <Icon glyph={passwordVisible ? EyeOff : Eye} />
      </IconButton>
    </>
  ) : trailing;
  const roles = typeRolesByLanguage[language];
  const rtlText = freeText && isRtl;
  const inputStyle: TextStyle = {
    ...roles[size === "sm" ? "bodySm" : "body"],
    ...(Platform.OS === "web" ? { fontSize: fontSize.inputWebMin } : null),
    minHeight: layout.tapMin,
    height: "auto",
    writingDirection: rtlText ? "rtl" : "ltr",
    textAlign: rtlText ? "right" : "left",
    ...(rest.multiline ? { minHeight: layout.controlLg * 2, textAlignVertical: "top" } : null),
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
      {label ? <Label nativeID={id + "-label"}><Label.Text style={roles.label}>{label}</Label.Text></Label> : null}
      {rest.multiline ? (
        <TextArea {...inputProps} />
      ) : leading || suffix ? (
        <LayoutDirection rtl={rtlText}>
          <InputGroup>
            {leading ? <InputGroup.Prefix>{leading}</InputGroup.Prefix> : null}
            <InputGroup.Input {...inputProps} />
            {suffix ? <InputGroup.Suffix>{suffix}</InputGroup.Suffix> : null}
          </InputGroup>
        </LayoutDirection>
      ) : <HeroInput {...inputProps} />}
      {error ? <FieldError nativeID={id + "-description"}><Text role="caption" tone="accent">{error}</Text></FieldError> : null}
      {!error && hint ? <Description nativeID={id + "-description"} style={roles.caption}>{hint}</Description> : null}
    </TextField>
  );
}
