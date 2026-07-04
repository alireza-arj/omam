import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, Laptop } from "lucide-react-native";
import type { WorkSessionCategory } from "@omam/contracts";
import { AttendanceCookieClock } from "../../src/components/attendance-cookie-clock";
import { formatDurationHms } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";

const categoryOptions: WorkSessionCategory[] = ["ONSITE", "REMOTE"];
const locale = "en-US";

function formatClockParts(date: Date) {
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
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [optimisticStartAt, setOptimisticStartAt] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WorkSessionCategory>("ONSITE");

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
    [now],
  );

  const { hour, minute, second } = useMemo(() => formatClockParts(now), [now]);

  const activeStartAt = summary.activeSession?.startAt ?? optimisticStartAt;
  const activeCategory = summary.activeSession?.category ?? selectedCategory;
  const isSessionRunning = Boolean(activeStartAt);
  const activeSeconds = activeStartAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(activeStartAt).getTime()) / 1000))
    : 0;

  const activeDurationClock = useMemo(() => formatDurationHms(activeSeconds), [activeSeconds]);

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
      await clockIn(selectedCategory);
    } catch (error) {
      if (!summary.activeSession) {
        setOptimisticStartAt(null);
      }
      const message =
        error instanceof Error
          ? error.message === "ATTENDANCE_CLOCKIN_FAILED" || error.message === "ATTENDANCE_CLOCKOUT_FAILED"
            ? "An unknown error occurred while tracking time."
            : error.message
          : "An unknown error occurred while tracking time.";
      Alert.alert("Time tracking failed", message);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#eef3ec]" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-5 pb-[132px] pt-0">
        <View className="items-center">
          <Text className="text-sm text-[#5f7268]">{displayDate}</Text>
          <Text
            className="mt-1 text-center text-[64px] leading-[70px] text-[#122b24]"
            style={{ fontWeight: "300" }}
          >
            {headlineTime}
          </Text>
        </View>

        <AttendanceCookieClock
          size={clockSize}
          isRunning={isSessionRunning}
          isMutating={isMutating}
          elapsedSeconds={activeSeconds}
          currentDate={now}
          onPress={handleAction}
          idleLabel="Start timer"
          runningLabel="Stop timer"
          savingLabel="Saving..."
          categorySelector={
            <View className="mt-3 flex-row rounded-full border border-[#d5dfd5] bg-[#f8fbf7] p-1">
              {categoryOptions.map((category) => {
                const isSelected = activeCategory === category;
                const Icon = category === "ONSITE" ? Building2 : Laptop;

                return (
                  <Pressable
                    key={category}
                    disabled={isSessionRunning || isMutating}
                    onPress={() => setSelectedCategory(category)}
                    className={`h-9 min-w-[104px] flex-row items-center justify-center gap-1.5 rounded-full px-3 ${
                      isSelected ? "bg-[#2f6558]" : "bg-transparent"
                    }`}
                  >
                    <Icon size={15} color={isSelected ? "#f4fbf7" : "#456b5f"} />
                    <Text className={`text-xs ${isSelected ? "text-white" : "text-[#456b5f]"}`}>
                      {category === "ONSITE" ? "On-site" : "Remote"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />

      </View>
    </SafeAreaView>
  );
}
