import { useState, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Accordion as HeroAccordion } from "heroui-native/accordion";
import { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { Text } from "./text";
import { layout, motion, type TypeRole } from "../tokens";

const contentEntering = FadeIn.duration(motion.durNormal).easing(
  Easing.bezier(motion.easeOut.x1, motion.easeOut.y1, motion.easeOut.x2, motion.easeOut.y2),
);
const contentExiting = FadeOut.duration(motion.durFast).easing(
  Easing.bezier(motion.easeOut.x1, motion.easeOut.y1, motion.easeOut.x2, motion.easeOut.y2),
);

export type AccordionProps = {
  title: string;
  titleRole?: TypeRole;
  meta?: string;
  leading?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export function Accordion({
  title, titleRole = "body", meta, leading, children,
  defaultExpanded = false, expanded, onExpandedChange, style,
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const open = expanded ?? uncontrolled;

  return (
    <HeroAccordion
      selectionMode="single"
      value={open ? "content" : ""}
      onValueChange={(value: string | undefined) => {
        const next = value === "content";
        if (expanded === undefined) setUncontrolled(next);
        onExpandedChange?.(next);
      }}
      hideSeparator
      style={style}
    >
      <HeroAccordion.Item value="content">
        <HeroAccordion.Trigger style={{ minHeight: layout.tapMin, paddingHorizontal: 0, gap: layout.gapDefault }}>
          {leading}
          <Text role={titleRole} tone="title" style={{ flex: 1, minWidth: 0 }}>{title}</Text>
          {meta ? <Text role="mono" tone="muted">{meta}</Text> : null}
          <HeroAccordion.Indicator />
        </HeroAccordion.Trigger>
        <HeroAccordion.Content
          animation={{ entering: { value: contentEntering }, exiting: { value: contentExiting } }}
          style={{ paddingHorizontal: 0 }}
        >
          {children}
        </HeroAccordion.Content>
      </HeroAccordion.Item>
    </HeroAccordion>
  );
}
