import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Icon } from "./icon";
import { Text } from "./text";
import { useTheme } from "../theme";
import { layout, motion, radius, type ColorScheme } from "../tokens";

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds on screen. `0` keeps it up until it is tapped. */
  duration?: number;
};

type ToastRecord = Required<Pick<ToastOptions, "title" | "tone" | "duration">> & {
  id: string;
  description?: string;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4500;
const MAX_VISIBLE = 3;

function paint(tone: ToastTone, colors: ColorScheme): { fill: string; text: string; glyph: LucideIcon } {
  switch (tone) {
    case "success":
      return { fill: colors.successFill, text: colors.successText, glyph: CircleCheck };
    case "warning":
      return { fill: colors.warningFill, text: colors.warningText, glyph: TriangleAlert };
    case "error":
      return { fill: colors.fillAccentSoft, text: colors.textAccent, glyph: CircleAlert };
    default:
      return { fill: colors.infoFill, text: colors.infoText, glyph: Info };
  }
}

/**
 * `Alert.alert` is a no-op on web, so every failure the app reported was
 * invisible in the PWA. This is the one notification surface — it renders the
 * same on native and on web.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const insets = useSafeAreaInsets();
  const sequence = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    sequence.current += 1;

    const record: ToastRecord = {
      id: `toast-${sequence.current}`,
      title: options.title,
      description: options.description,
      tone: options.tone ?? "info",
      duration: options.duration ?? DEFAULT_DURATION,
    };

    setToasts((current) => [...current, record].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast, dismissToast }), [
    dismissToast,
    showToast,
  ]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <View
        pointerEvents="box-none"
        style={{
          gap: layout.gapTight,
          left: 0,
          paddingHorizontal: layout.padPage,
          position: "absolute",
          right: 0,
          top: insets.top + layout.gapTight,
        }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

type ToastCardProps = {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
};

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const { colors, elevation } = useTheme();
  const { fill, text, glyph } = paint(toast.tone, colors);

  useEffect(() => {
    if (!toast.duration) {
      return;
    }

    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);

    return () => clearTimeout(timer);
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <Animated.View
      entering={FadeInUp.duration(motion.durNormal)}
      // Reanimated's exit and layout animations orphan the DOM node on web:
      // React unmounts the toast but the element stays on screen for good.
      // A stuck error banner is worse than no exit animation.
      {...(Platform.OS === "web"
        ? null
        : {
            exiting: FadeOutUp.duration(motion.durFast),
            layout: LinearTransition.duration(motion.durFast),
          })}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={toast.description ? `${toast.title}. ${toast.description}` : toast.title}
        onPress={() => onDismiss(toast.id)}
        style={({ pressed }) => [
          {
            alignItems: "flex-start",
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.card,
            flexDirection: "row",
            gap: layout.gapDefault,
            opacity: pressed ? 0.92 : 1,
            padding: layout.padCard,
          },
          elevation(3),
        ]}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: fill,
            borderRadius: radius.sm,
            height: 26,
            justifyContent: "center",
            width: 26,
          }}
        >
          <Icon glyph={glyph} size={16} color={text} />
        </View>

        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text role="label" tone="title">
            {toast.title}
          </Text>
          {toast.description ? (
            <Text role="caption" tone="muted">
              {toast.description}
            </Text>
          ) : null}
        </View>

        <Icon glyph={X} size={16} color={colors.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return ctx;
}
