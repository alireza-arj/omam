import { useId, type ReactNode } from "react";
import { type TextInputProps, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { TextField } from "heroui-native/text-field";
import { Input as HeroInput } from "heroui-native/input";
import { InputGroup } from "heroui-native/input-group";
import { TextArea } from "heroui-native/text-area";
import { Label } from "heroui-native/label";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Text } from "./text";
import { LayoutDirection } from "uniwind";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

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
  const { isRtl, language } = useLanguage();
  const roles = typeRolesByLanguage[language];
  const rtlText = freeText && isRtl;
  const inputStyle: TextStyle = {
    ...roles[size === "sm" ? "bodySm" : "body"],
    minHeight: layout.tapMin,
    height: "auto",
    writingDirection: rtlText ? "rtl" : "ltr",
    textAlign: rtlText ? "right" : "left",
    ...(rest.multiline ? { minHeight: layout.controlLg * 2, textAlignVertical: "top" } : null),
  };
  const inputProps = {
    ...rest,
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
      ) : leading || trailing ? (
        <LayoutDirection rtl={rtlText}>
          <InputGroup>
            {leading ? <InputGroup.Prefix>{leading}</InputGroup.Prefix> : null}
            <InputGroup.Input {...inputProps} />
            {trailing ? <InputGroup.Suffix>{trailing}</InputGroup.Suffix> : null}
          </InputGroup>
        </LayoutDirection>
      ) : <HeroInput {...inputProps} />}
      {error ? <FieldError nativeID={id + "-description"}><Text role="caption" tone="accent">{error}</Text></FieldError> : null}
      {!error && hint ? <Description nativeID={id + "-description"} style={roles.caption}>{hint}</Description> : null}
    </TextField>
  );
}
