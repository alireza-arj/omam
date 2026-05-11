import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Text, View } from "react-native";
export function SectionTitle({ eyebrow, title, description }) {
    return (_jsxs(View, { className: "gap-1", children: [_jsx(Text, { className: "text-xs uppercase tracking-[2px] text-mint/70", children: eyebrow }), _jsx(Text, { className: "text-3xl font-semibold text-mist", children: title }), description ? _jsx(Text, { className: "text-sm leading-6 text-muted", children: description }) : null] }));
}
