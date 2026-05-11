import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarDays, Clock3, ListChecks } from "lucide-react-native";
import { SessionItem } from "../../src/components/session-item";
import { formatMinutes, sessionMinutes } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useLanguage } from "../../src/providers/language-provider";

function buildDayChips(isoDates: string[], locale: string) {
  const formatDay = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const formatWeekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const formatMonth = new Intl.DateTimeFormat(locale, { month: "short" });

  return isoDates.map((iso) => {
    const date = new Date(iso);

    return {
      key: iso,
      day: formatDay.format(date),
      weekday: formatWeekday.format(date),
      month: formatMonth.format(date),
    };
  });
}

export default function HistoryScreen() {
  const { sessions } = useAttendance();
  const { language, locale, t } = useLanguage();

  const totalMinutes = sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const chips = useMemo(() => {
    const uniqueDays = Array.from(new Set(sessions.map((item) => item.startAt.slice(0, 10))));
    return buildDayChips(uniqueDays.slice(0, 8), locale);
  }, [locale, sessions]);

  return (
    <SafeAreaView className="flex-1 bg-[#eef3ec]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 122,
          paddingTop: 10,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-[28px] border border-[#cfdacc] bg-[#f8f4e9] p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-[#5d7166]">{t("history.logs")}</Text>
              <Text className="mt-1 text-[34px] leading-[38px] text-[#17392f]">{t("history.title")}</Text>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#dbeadf]">
              <CalendarDays size={18} color="#245f4f" />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {chips.length ? (
              chips.map((chip, index) => (
                <View
                  key={chip.key}
                  className={`min-w-[66px] rounded-xl border px-3 py-2 ${
                    index === 0 ? "border-[#2d6d5b] bg-[#2d6d5b]" : "border-[#d2ddcf] bg-[#f8fbf7]"
                  }`}
                >
                  <Text className={`text-center text-base ${index === 0 ? "text-white" : "text-[#1f382f]"}`}>{chip.day}</Text>
                  <Text className={`text-center text-xs ${index === 0 ? "text-[#d6eae2]" : "text-[#5f7368]"}`}>{chip.month}</Text>
                  <Text className={`text-center text-xs ${index === 0 ? "text-[#d6eae2]" : "text-[#5f7368]"}`}>{chip.weekday}</Text>
                </View>
              ))
            ) : (
              <Text className="text-sm text-[#5f7268]">{t("history.emptyState")}</Text>
            )}
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-[#d0dccf] bg-[#e7f1eb] p-4">
            <View className="mb-2 h-8 w-8 items-center justify-center rounded-full bg-[#d5e8dd]">
              <ListChecks size={16} color="#2c6d59" />
            </View>
            <Text className="text-sm text-[#587066]">{t("history.sessions")}</Text>
            <Text className="mt-1 text-[32px] leading-[36px] text-[#193a30]">{sessions.length}</Text>
            <Text className="text-xs text-[#60756a]">{t("history.totalRecords")}</Text>
          </View>

          <View className="flex-1 rounded-2xl border border-[#ddcfb6] bg-[#fbf6ea] p-4">
            <View className="mb-2 h-8 w-8 items-center justify-center rounded-full bg-[#f2e4c8]">
              <Clock3 size={15} color="#996a24" />
            </View>
            <Text className="text-sm text-[#6f665a]">{t("history.tracked")}</Text>
            <Text className="mt-1 text-[24px] leading-[28px] text-[#2d2a26]">{formatMinutes(totalMinutes, language)}</Text>
            <Text className="text-xs text-[#8c7f6b]">{t("history.workedTime")}</Text>
          </View>
        </View>

        <View className="rounded-2xl border border-[#d0dccf] bg-[#f8fbf7] p-4">
          <Text className="mb-3 text-xl text-[#18352d]">{t("history.recentSessions")}</Text>

          <View className="gap-3">
            {sessions.length ? (
              sessions.map((session) => <SessionItem key={session.id} session={session} />)
            ) : (
              <View className="rounded-xl border border-[#d2ddcf] bg-[#f1f7f2] p-4">
                <Text className="text-sm leading-6 text-[#5f7268]">{t("history.emptyState")}</Text>
              </View>
            )}
          </View>
        </View>

        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
}
