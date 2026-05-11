import { useEffect, useMemo, useState } from "react";
import { Alert, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AttendanceCookieClock } from "../../src/components/attendance-cookie-clock";
import { formatDurationHms } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useLanguage } from "../../src/providers/language-provider";

function formatClockParts(date: Date, locale: string) {
  const formatter = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  return {
    hour: formatter.format(date.getHours()),
    minute: formatter.format(date.getMinutes()),
    second: formatter.format(date.getSeconds()),
  };
}

export default function DashboardScreen() {
  const { summary, clockIn, clockOut, isMutating } = useAttendance();
  const { language, locale, t } = useLanguage();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [optimisticStartAt, setOptimisticStartAt] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  const displayDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
        weekday: "long",
      }).format(now),
    [locale, now],
  );

  const { hour, minute, second } = useMemo(() => formatClockParts(now, locale), [locale, now]);

  const activeStartAt = summary.activeSession?.startAt ?? optimisticStartAt;
  const isSessionRunning = Boolean(activeStartAt);
  const activeSeconds = activeStartAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(activeStartAt).getTime()) / 1000))
    : 0;

  const activeDurationClock = useMemo(() => formatDurationHms(activeSeconds, language), [activeSeconds, language]);

  const clockSize = useMemo(() => Math.min(Math.max(width * 0.78, 250), 336), [width]);
  const headlineTime = isSessionRunning ? activeDurationClock : `${hour}:${minute}:${second}`;

  async function handleAction() {
    try {
      if (summary.activeSession) {
        setOptimisticStartAt(null);
        await clockOut();
        return;
      }

      setOptimisticStartAt(new Date().toISOString());
      await clockIn();
    } catch (error) {
      if (!summary.activeSession) {
        setOptimisticStartAt(null);
      }
      const message =
        error instanceof Error
          ? error.message === "ATTENDANCE_CLOCKIN_FAILED" || error.message === "ATTENDANCE_CLOCKOUT_FAILED"
            ? t("dashboard.trackFailedFallback")
            : error.message
          : t("dashboard.trackFailedFallback");
      Alert.alert(t("dashboard.trackFailedTitle"), message);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#eef3ec]" edges={["top"]}>
      <View className="flex-1 items-center justify-between px-5 pb-[112px] pt-5">
        <View className="items-center">
          <Text className="text-sm text-[#5f7268]">{displayDate}</Text>
          <Text
            className="mt-2 text-center text-[52px] leading-[58px] text-[#122b24]"
            style={language === "fa" ? { fontFamily: "Vazirmatn_300Light", fontWeight: "300" } : { fontWeight: "300" }}
          >
            {headlineTime}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className={`h-2.5 w-2.5 rounded-full ${isSessionRunning ? "bg-[#69F3C6]" : "bg-[#8f9f98]"}`} />
            <Text className="text-sm text-[#325348]">{isSessionRunning ? t("dashboard.running") : t("dashboard.ready")}</Text>
          </View>
        </View>

        <AttendanceCookieClock
          size={clockSize}
          isRunning={isSessionRunning}
          isMutating={isMutating}
          elapsedSeconds={activeSeconds}
          currentDate={now}
          onPress={handleAction}
          idleLabel="click to start"
          runningLabel="click to end"
          savingLabel={t("common.saving")}
        />

        <Text className="text-sm text-[#5f7268]">{t("dashboard.clockTapHint")}</Text>
      </View>
    </SafeAreaView>
  );
}
