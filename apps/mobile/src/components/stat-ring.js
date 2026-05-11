import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { formatShortMinutes } from "../lib/format";
import { useLanguage } from "../providers/language-provider";
export function StatRing({ progress, totalMinutes, goalHours }) {
    const { language, t } = useLanguage();
    const size = 168;
    const stroke = 14;
    const radius = (size - stroke) / 2;
    const path = useMemo(() => {
        const arc = Skia.Path.Make();
        arc.addArc({
            x: stroke / 2,
            y: stroke / 2,
            width: size - stroke,
            height: size - stroke,
        }, -210, Math.min(progress, 1) * 300);
        return arc;
    }, [progress]);
    return (_jsx(View, { className: "items-center justify-center", children: _jsxs(View, { style: { width: size, height: size }, children: [_jsxs(Canvas, { style: { flex: 1 }, children: [_jsx(Circle, { cx: size / 2, cy: size / 2, r: radius, color: "rgba(255,255,255,0.08)", style: "stroke", strokeWidth: stroke }), _jsx(Path, { path: path, color: "#69f3c6", style: "stroke", strokeWidth: stroke, strokeCap: "round" })] }), _jsxs(View, { className: "absolute inset-0 items-center justify-center gap-1", children: [_jsx(Text, { className: "text-xs uppercase tracking-[2px] text-mint/70", children: t("stat.monthProgress") }), _jsx(Text, { className: "text-2xl font-semibold text-mist", children: formatShortMinutes(totalMinutes, language) }), _jsx(Text, { className: "text-sm text-muted", children: t("stat.goalHours", { hours: goalHours }) })] })] }) }));
}
