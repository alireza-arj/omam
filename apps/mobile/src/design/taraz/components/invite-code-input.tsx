import { Fragment, useId } from "react";
import { View, type TextInputProps } from "react-native";
import { LayoutDirection } from "uniwind";
import { InputOTP } from "heroui-native/input-otp";
import { layout, radius, space, typeRoles } from "../tokens";
import { useColors } from "../theme";
import { Text } from "./text";

export function InviteCodeInput({ label, hint, value, onChange, disabled = false, invalid = false }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const colors = useColors();
  const id = useId();
  // Let formatted paste reach HeroUI's transformer before it limits the eight slots.
  const textInputProps: TextInputProps = {
    maxLength: 40, accessibilityLabel: label, autoCapitalize: "characters", autoCorrect: false, accessibilityHint: hint,
  };
  return (
    <View style={{ gap: layout.gapTight }}>
      <Text nativeID={`${id}-label`} role="label">{label}</Text>
      <LayoutDirection rtl={false}>
        <InputOTP
          value={value}
          onChange={(next) => onChange(next.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
          pasteTransformer={(next) => next.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}
          variant="primary"
          maxLength={8}
          inputMode="text"
          pattern="^[a-zA-Z0-9]+$"
          isDisabled={disabled}
          isInvalid={invalid}
          textInputProps={textInputProps}
          style={{ direction: "ltr", flexDirection: "row", alignItems: "center", gap: space[3], width: "100%" }}
        >
          {[0, 1].map((group) => (
            <Fragment key={group}>
              {group === 1 ? <InputOTP.Separator style={{ width: space[4], height: space[1], flexShrink: 0, borderRadius: radius.full, backgroundColor: colors.textMuted }} /> : null}
              <InputOTP.Group style={{ flex: 1, minWidth: 0, flexDirection: "row", gap: space[4] }}>
                {({ slots, isFocused }) => slots.filter((slot) => Math.floor(slot.index / 4) === group).map((slot) => (
                  <InputOTP.Slot key={slot.index} index={slot.index} background={null} style={{ flex: 1, width: 0, minWidth: 0, height: layout.controlLg, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: layout.hairline, borderColor: invalid ? colors.warningText : isFocused && slot.isActive ? colors.lineAccent : colors.lineHairline }}>
                    <InputOTP.SlotValue style={{ ...typeRoles.title3, color: colors.textTitle }} />
                    <InputOTP.SlotCaret />
                  </InputOTP.Slot>
                ))}
              </InputOTP.Group>
            </Fragment>
          ))}
        </InputOTP>
      </LayoutDirection>
      {hint ? <Text nativeID={`${id}-hint`} role="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
}
