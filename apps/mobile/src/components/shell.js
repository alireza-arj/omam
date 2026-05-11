import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
export function ScreenShell({ children }) {
    return (_jsxs(SafeAreaView, { className: "flex-1 bg-night", edges: ["top"], children: [_jsx(LinearGradient, { colors: ["#08111f", "#10203b", "#08111f"], start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, style: { position: "absolute", inset: 0 } }), _jsx(View, { className: "absolute rounded-full bg-sky/10", style: {
                    left: -60,
                    top: 64,
                    width: 224,
                    height: 224,
                } }), _jsx(View, { className: "absolute rounded-full bg-coral/10", style: {
                    right: -40,
                    top: 208,
                    width: 192,
                    height: 192,
                } }), _jsx(ScrollView, { className: "flex-1", contentContainerStyle: {
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 140,
                    gap: 18,
                }, showsVerticalScrollIndicator: false, children: children })] }));
}
