import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LogIn, LogOut } from "lucide-react-native";
import { formatDurationHms } from "../lib/format";
const CLOCK_SIZE = 196;
const CLOCK_TILT = "26deg";
const AnimatedView = Animated.createAnimatedComponent(View);
function angleFromElapsed(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const sec = safe % 60;
    const min = Math.floor(safe / 60) % 60;
    const hour = Math.floor(safe / 3600) % 12;
    return {
        secondAngle: sec * 6,
        minuteAngle: min * 6 + sec * 0.1,
        hourAngle: hour * 30 + min * 0.5,
    };
}
function angleFromDate(date) {
    const sec = date.getSeconds();
    const min = date.getMinutes();
    const hour = date.getHours() % 12;
    return {
        secondAngle: sec * 6,
        minuteAngle: min * 6 + sec * 0.1,
        hourAngle: hour * 30 + min * 0.5,
    };
}
export function AttendanceCookieClock({ isRunning, isMutating, elapsedSeconds, currentDate, language, onPress, idleLabel, runningLabel, savingLabel, }) {
    const tapScale = useRef(new Animated.Value(0)).current;
    const tapGlow = useRef(new Animated.Value(0)).current;
    const glowScale = tapGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.06],
    });
    const glowOpacity = tapGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [0.22, 0],
    });
    const scale = tapScale.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.03],
    });
    const runningAngles = useMemo(() => angleFromElapsed(elapsedSeconds), [elapsedSeconds]);
    const idleAngles = useMemo(() => angleFromDate(currentDate), [currentDate]);
    const activeAngles = isRunning ? runningAngles : idleAngles;
    const hourAngle = activeAngles.hourAngle;
    const minuteAngle = activeAngles.minuteAngle;
    const secondAngle = activeAngles.secondAngle;
    const ticks = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);
    function handlePress() {
        if (isMutating) {
            return;
        }
        if (!isRunning) {
            tapScale.stopAnimation();
            tapGlow.stopAnimation();
            tapScale.setValue(0);
            tapGlow.setValue(0);
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(tapScale, {
                        toValue: 1,
                        duration: 210,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                    }),
                    Animated.timing(tapScale, {
                        toValue: 0,
                        duration: 240,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(tapGlow, {
                        toValue: 1,
                        duration: 230,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(tapGlow, {
                        toValue: 0,
                        duration: 260,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        }
        onPress();
    }
    return (_jsxs(Pressable, { onPress: handlePress, disabled: isMutating, className: "h-[248px] w-[248px] items-center justify-center", children: [_jsxs(AnimatedView, { style: {
                    width: CLOCK_SIZE,
                    height: CLOCK_SIZE,
                    borderRadius: 999,
                    transform: [{ perspective: 980 }, { rotateX: CLOCK_TILT }, { scale }],
                }, children: [_jsx(AnimatedView, { style: {
                            position: "absolute",
                            inset: -7,
                            borderRadius: 999,
                            borderWidth: 3,
                            borderColor: "#bdd8c9",
                            opacity: glowOpacity,
                            transform: [{ scale: glowScale }],
                        } }), _jsx(View, { style: {
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            backgroundColor: "#274f42",
                            transform: [{ translateY: 8 }],
                        } }), _jsx(View, { className: "absolute inset-0 rounded-full bg-[#1e6f4d]" }), isRunning ? (_jsx(LinearGradient, { colors: ["#1e6f4d", "#3f9974", "#7db389", "#c9ad64"], start: { x: 0.08, y: 0.12 }, end: { x: 0.92, y: 0.92 }, style: { position: "absolute", inset: 0, borderRadius: 999 } })) : null, _jsx(View, { className: "absolute inset-[8px] rounded-full bg-[#e8f2eb]" }), _jsx(View, { className: "absolute inset-[12px] rounded-full border border-[#cfded3] bg-[#f8fdf9]" }), _jsx(View, { className: "absolute inset-[14px] rounded-full border border-[#eaf3ed]" }), _jsxs(View, { className: "absolute inset-[20px] rounded-full bg-[#f4f9f5]", children: [ticks.map((tick) => {
                                const isMajor = tick % 5 === 0;
                                return (_jsx(View, { style: {
                                        position: "absolute",
                                        left: "50%",
                                        top: "50%",
                                        width: isMajor ? 2.6 : 1.5,
                                        height: isMajor ? 12 : 6,
                                        marginLeft: isMajor ? -1.3 : -0.75,
                                        marginTop: -68,
                                        borderRadius: 999,
                                        backgroundColor: isMajor ? "#4a6660" : "#93ada1",
                                        transform: [{ rotate: `${tick * 6}deg` }],
                                    } }, `tick-${tick}`));
                            }), _jsxs(View, { className: "absolute inset-0 items-center justify-center", children: [_jsx(Text, { className: "absolute top-[44px] text-[10px] tracking-[1.5px] text-[#6c8479]", children: "OMAM" }), _jsx(Text, { className: "absolute left-1/2 top-[12px] -translate-x-1/2 text-[11px] text-[#6d8279]", children: "12" }), _jsx(Text, { className: "absolute right-[10px] top-1/2 -translate-y-1/2 text-[11px] text-[#6d8279]", children: "3" }), _jsx(Text, { className: "absolute bottom-[9px] left-1/2 -translate-x-1/2 text-[11px] text-[#6d8279]", children: "6" }), _jsx(Text, { className: "absolute left-[10px] top-1/2 -translate-y-1/2 text-[11px] text-[#6d8279]", children: "9" }), _jsx(View, { style: {
                                            position: "absolute",
                                            width: 5,
                                            height: 42,
                                            borderRadius: 999,
                                            backgroundColor: "#123634",
                                            transform: [{ rotate: `${hourAngle}deg` }, { translateY: -20 }],
                                        } }), _jsx(View, { style: {
                                            position: "absolute",
                                            width: 3,
                                            height: 58,
                                            borderRadius: 999,
                                            backgroundColor: "#24534f",
                                            transform: [{ rotate: `${minuteAngle}deg` }, { translateY: -28 }],
                                        } }), _jsx(View, { style: {
                                            position: "absolute",
                                            width: 2,
                                            height: 68,
                                            borderRadius: 999,
                                            backgroundColor: isRunning ? "#c44b3f" : "#6f857b",
                                            transform: [{ rotate: `${secondAngle}deg` }, { translateY: -34 }],
                                        } }), _jsx(View, { className: "h-[17px] w-[17px] rounded-full bg-[#1e6f4d]" }), _jsx(View, { className: "absolute h-[9px] w-[9px] rounded-full border border-[#1b6c4a] bg-[#f8fdf9]" })] }), _jsx(LinearGradient, { colors: ["rgba(255,255,255,0.62)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"], start: { x: 0.12, y: 0.08 }, end: { x: 0.82, y: 0.82 }, style: {
                                    position: "absolute",
                                    left: 16,
                                    right: 16,
                                    top: 14,
                                    bottom: 44,
                                    borderRadius: 999,
                                } }), _jsx(View, { className: "absolute bottom-[12px] left-0 right-0 items-center", children: _jsx(View, { className: "rounded-full border border-[#d7e4db] bg-[#eaf3ec] px-3 py-1", children: isRunning ? _jsx(LogOut, { size: 16, color: "#c44b3f" }) : _jsx(LogIn, { size: 16, color: "#1b7a51" }) }) })] })] }), _jsxs(View, { className: "mt-4 items-center", children: [_jsx(Text, { className: "text-base text-[#1a3a39]", children: isMutating ? savingLabel : isRunning ? runningLabel : idleLabel }), _jsx(Text, { className: "mt-1 text-sm text-[#5a6d70]", children: formatDurationHms(elapsedSeconds, language) })] })] }));
}
