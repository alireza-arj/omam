import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, CalendarDays, Clock3, ListChecks, LogIn, LogOut, Target, Wallet } from "lucide-react-native";
import { SessionItem } from "../../src/components/session-item";
import { formatCurrency, formatMinutes } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useLanguage } from "../../src/providers/language-provider";

function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ReportScreen() {
  const { sessions, settings, summary } = useAttendance();
  const { language, locale, t } = useLanguage();

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [sessions],
  );
  const latestSession = sortedSessions[0];
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const progress =
    settings.monthlyGoalHours > 0
      ? Math.min(100, Math.round((summary.totalMinutes / (settings.monthlyGoalHours * 60)) * 100))
      : 0;

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
        <View className="overflow-hidden rounded-[30px] border border-[#2a5b50] bg-[#2f6558] p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-[#cde5da]">{t("report.finance")}</Text>
              <Text className="mt-1 text-[34px] leading-[38px] text-white">{t("report.title")}</Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#45796a]">
              <BarChart3 size={20} color="#d9efe5" />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-[#74a793] bg-[#f2f9f5] p-3.5">
              <Text className="text-xs uppercase tracking-[1.1px] text-[#57776b]">{t("report.tracked")}</Text>
              <Text className="mt-1 text-[29px] leading-[32px] text-[#17372e]">{formatMinutes(summary.totalMinutes, language)}</Text>
              <Text className="text-xs text-[#67877a]">{t("report.thisMonth")}</Text>
            </View>

            <View className="flex-1 rounded-2xl border border-[#dcb26d] bg-[#fff6e7] p-3.5">
              <Text className="text-xs uppercase tracking-[1.1px] text-[#8b6d3f]">{t("report.earned")}</Text>
              <Text className="mt-1 text-[20px] leading-[24px] text-[#403425]">
                {formatCurrency(summary.totalIncome, settings.currency, language)}
              </Text>
              <Text className="text-xs text-[#9d7f50]">{t("report.calculated")}</Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-[#d0dccf] bg-[#f8fbf7] p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Target size={16} color="#2c6d59" />
              <Text className="text-lg text-[#17362e]">{t("report.monthlyGoal")}</Text>
            </View>
            <Text className="text-[28px] text-[#2c8c68]">{progress}%</Text>
          </View>

          <View className="h-3 rounded-full bg-[#e5ede8]">
            <View
              className="h-3 rounded-full bg-[#5cb58e]"
              style={{
                width: `${progress}%`,
              }}
            />
          </View>

          <Text className="mt-2 text-sm text-[#5f7268]">
            {t("report.targetCurrent", {
              target: numberFormatter.format(settings.monthlyGoalHours),
              current: numberFormatter.format(Math.round(summary.totalMinutes / 60)),
            })}
          </Text>
        </View>

        <View className="rounded-2xl border border-[#d0dccf] bg-[#f8fbf7] p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <CalendarDays size={18} color="#245f4f" />
            <Text className="text-xl text-[#18352d]">{t("history.logs")}</Text>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 rounded-xl border border-[#d8dfdb] bg-white p-3">
              <View className="mb-1 flex-row items-center gap-2">
                <LogIn size={14} color="#2f6b58" />
                <Text className="text-sm text-[#3e5b52]">{t("dashboard.checkIn")}</Text>
              </View>
              <Text className="text-base text-[#15241f]">
                {latestSession ? formatTime(latestSession.startAt, locale) : "--:--"}
              </Text>
            </View>

            <View className="flex-1 rounded-xl border border-[#d8dfdb] bg-white p-3">
              <View className="mb-1 flex-row items-center gap-2">
                <LogOut size={14} color="#8f5f23" />
                <Text className="text-sm text-[#3e5b52]">{t("dashboard.checkOut")}</Text>
              </View>
              <Text className="text-base text-[#15241f]">
                {latestSession?.endAt ? formatTime(latestSession.endAt, locale) : latestSession ? t("format.running") : "--:--"}
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row gap-3">
            <View className="flex-1 rounded-xl border border-[#d8dfdb] bg-white p-3">
              <View className="mb-1 flex-row items-center gap-2">
                <Clock3 size={14} color="#2f6b58" />
                <Text className="text-sm text-[#3e5b52]">{t("report.monthlyGoal")}</Text>
              </View>
              <Text className="text-base text-[#15241f]">
                {numberFormatter.format(settings.monthlyGoalHours)} {t("format.hour")}
              </Text>
            </View>

            <View className="flex-1 rounded-xl border border-[#d8dfdb] bg-white p-3">
              <View className="mb-1 flex-row items-center gap-2">
                <Wallet size={14} color="#2f6b58" />
                <Text className="text-sm text-[#3e5b52]">{t("report.earned")}</Text>
              </View>
              <Text className="text-base text-[#15241f]">
                {formatCurrency(summary.totalIncome, settings.currency, language)}
              </Text>
            </View>
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
            <Text className="mt-1 text-[24px] leading-[28px] text-[#2d2a26]">{formatMinutes(summary.totalMinutes, language)}</Text>
            <Text className="text-xs text-[#8c7f6b]">{t("history.workedTime")}</Text>
          </View>
        </View>

        <View className="rounded-2xl border border-[#d0dccf] bg-[#f8fbf7] p-4">
          <Text className="mb-3 text-xl text-[#18352d]">{t("history.recentSessions")}</Text>
          <View className="gap-3">
            {sortedSessions.length ? (
              sortedSessions.map((session) => <SessionItem key={session.id} session={session} />)
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
