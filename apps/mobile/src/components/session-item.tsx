import { View } from "react-native";
import { Building2, ChevronRight, Laptop } from "lucide-react-native";
import type { SessionDto } from "@omam/contracts";
import {
  formatDayLabel,
  formatSessionRange,
  formatShortMinutes,
  sessionMinutes,
} from "../lib/format";
import { useAttendance } from "../providers/attendance-provider";
import { Badge, Icon, Text, PressableFeedback, layout, useColors, useLanguage } from "../design/taraz";

type Props = {
  session: SessionDto;
  /** Off inside a day group, where the date is already the section heading. */
  showDate?: boolean;
  /** Opens the session editor. Adds a chevron and a press state when set. */
  onPress?: () => void;
};

export function SessionItem({ session, showDate = true, onPress }: Props) {
  const colors = useColors();
  const { calendar } = useAttendance();
  const { language, t } = useLanguage();
  const isRemote = session.category === "REMOTE";
  const isOpen = !session.endAt;

  const content = (
    <>
      <Icon glyph={isRemote ? Laptop : Building2} size={20} color={colors.textMuted} />

      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        {showDate ? (
          <>
            <Text role="body" tone="title" numberOfLines={1}>
              {formatDayLabel(session.startAt, calendar, language)}
            </Text>
            <Text role="mono" tone="muted" numberOfLines={1}>
              {formatSessionRange(session, t)}
            </Text>
          </>
        ) : (
          <Text role="mono" tone="title" numberOfLines={1}>
            {formatSessionRange(session, t)}
          </Text>
        )}

        {session.note ? (
          <Text role="caption" tone="muted" numberOfLines={1}>
            {session.note}
          </Text>
        ) : null}

      </View>

      {isOpen ? (
        <Badge label={t("status.OPEN")} tone="accent" />
      ) : (
        <Text role="mono" tone="body">
          {formatShortMinutes(sessionMinutes(session), language)}
        </Text>
      )}

      {onPress ? <Icon glyph={ChevronRight} size={16} color={colors.textFaint} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        {content}
      </View>
    );
  }

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${t("session.editTitle")}, ${formatSessionRange(session, t)}`}
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: layout.gapDefault,
        minHeight: layout.tapMin,
      }}
    >
      {content}
    </PressableFeedback>
  );
}
