import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import { Icon } from "./icon";
import { Text } from "./text";
import { useColors } from "../theme";
import { layout, motion, type TypeRole } from "../tokens";

export type AccordionProps = {
  title: string;
  /**
   * Header type role. Defaults to a list row; pass `title3` when the accordion
   * *is* a card's section heading and has to weigh the same as its siblings.
   */
  titleRole?: TypeRole;
  /** Counts and durations sit at the end of the header, monospaced. */
  meta?: string;
  leading?: ReactNode;
  children: ReactNode;
  /** Uncontrolled starting state. Ignored when `expanded` is passed. */
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/** The one easing family, at the layout duration — it slides, it never bounces. */
const ease = Easing.bezier(
  motion.easeStandard.x1,
  motion.easeStandard.y1,
  motion.easeStandard.x2,
  motion.easeStandard.y2,
);

/**
 * A disclosure row over a hairline. Collapsed is the resting state: a long list
 * reads as its summary first, and only the section you ask for opens.
 */
export function Accordion({
  title,
  titleRole = "body",
  meta,
  leading,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  style,
}: AccordionProps) {
  const colors = useColors();
  const isControlled = expanded !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const open = isControlled ? expanded : uncontrolled;

  const progress = useSharedValue(open ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: motion.durSlow, easing: ease });
  }, [open, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: progress.value * contentHeight.value,
    opacity: progress.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  function toggle() {
    const next = !open;

    if (!isControlled) {
      setUncontrolled(next);
    }

    onExpandedChange?.(next);
  }

  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => ({
          alignItems: "center",
          flexDirection: "row",
          gap: layout.gapDefault,
          minHeight: layout.tapMin,
          paddingVertical: layout.padControlY,
          transform: [{ scale: pressed ? motion.pressScaleLarge : 1 }],
        })}
      >
        {leading}

        <Text role={titleRole} tone="title" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
          {title}
        </Text>

        {meta ? (
          <Text role="mono" tone="muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}

        <Animated.View style={chevronStyle}>
          <Icon glyph={ChevronDown} size={20} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        pointerEvents={open ? "auto" : "none"}
        style={[{ overflow: "hidden" }, bodyStyle]}
      >
        {/*
         * Absolutely positioned so its height is the content's natural height.
         * As a flex child it would be capped by the animated height above it,
         * and `onLayout` would never report growth — content that appears
         * while the section is open (a validation message, say) got clipped.
         */}
        <View
          onLayout={(event) => {
            contentHeight.value = event.nativeEvent.layout.height;
          }}
          style={{ left: 0, position: "absolute", right: 0, top: 0 }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
