import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View } from "react-native";
import { BlurView } from "expo-blur";
export function GlassCard({ children }) {
    return (_jsxs(View, { className: "overflow-hidden rounded-[28px] border border-white/10 bg-white/5", children: [_jsx(BlurView, { intensity: 24, tint: "dark", experimentalBlurMethod: "dimezisBlurView", style: { position: "absolute", inset: 0 } }), _jsx(View, { className: "gap-4 p-5", children: children })] }));
}
