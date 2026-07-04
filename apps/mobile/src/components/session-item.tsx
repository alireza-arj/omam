import { Text, View } from "react-native";
import { Building2, Clock3, Laptop } from "lucide-react-native";
import type { SessionDto } from "@omam/contracts";
import {
  formatDayLabel,
  formatMinutes,
  formatSessionRange,
  sessionMinutes,
} from "../lib/format";

type Props = {
  session: SessionDto;
};

export function SessionItem({ session }: Props) {
  const CategoryIcon = session.category === "REMOTE" ? Laptop : Building2;

  return (
    <View className="rounded-xl border border-[#d8dfdb] bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="rounded-full border border-[#d8dfdb] bg-[#f8fbf9] px-3 py-1">
          <Text className="text-xs uppercase tracking-[1.2px] text-[#4f6159]">Session</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 rounded-full border border-[#d8dfdb] bg-[#f8fbf9] px-3 py-1">
            <CategoryIcon size={14} color="#305a49" />
            <Text className="text-sm text-[#173129]">
              {session.category === "REMOTE" ? "Remote" : "On-site"}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full border border-[#d8dfdb] bg-[#f8fbf9] px-3 py-1">
            <Clock3 size={14} color="#305a49" />
            <Text className="text-sm text-[#173129]">{formatMinutes(sessionMinutes(session))}</Text>
          </View>
        </View>
      </View>

      <Text className="text-base text-[#15241f]">{formatDayLabel(session.startAt)}</Text>
      <Text className="mt-1 text-sm text-[#5d6963]">{formatSessionRange(session)}</Text>
      {session.note ? <Text className="mt-2 text-sm text-[#665741]">{session.note}</Text> : null}
    </View>
  );
}
