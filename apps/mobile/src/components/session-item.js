import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Text, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { formatDayLabel, formatMinutes, formatSessionRange, sessionMinutes, } from "../lib/format";
import { useLanguage } from "../providers/language-provider";
export function SessionItem({ session }) {
    const { language, t } = useLanguage();
    return (_jsxs(View, { className: "rounded-[20px] border border-[#d7e4db] bg-white p-4", children: [_jsxs(View, { className: "mb-3 flex-row items-center justify-between", children: [_jsx(View, { className: "rounded-full bg-[#eaf4ed] px-3 py-1", children: _jsx(Text, { className: "text-xs uppercase tracking-[1.2px] text-[#366457]", children: t("session.label") }) }), _jsxs(View, { className: "flex-row items-center gap-1 rounded-full bg-[#edf5ef] px-3 py-1", children: [_jsx(Clock3, { size: 14, color: "#235246" }), _jsx(Text, { className: "text-sm text-[#18393b]", children: formatMinutes(sessionMinutes(session), language) })] })] }), _jsx(Text, { className: "text-base text-[#132a2c]", children: formatDayLabel(session.startAt, language) }), _jsx(Text, { className: "mt-1 text-sm text-[#597073]", children: formatSessionRange(session, language) }), session.note ? _jsx(Text, { className: "mt-2 text-sm text-[#6f5b3c]", children: session.note }) : null] }));
}
