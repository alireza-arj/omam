import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";

export function GlassCard({ children }: PropsWithChildren) {
  return (
    <View className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
      <BlurView
        intensity={24}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={{ position: "absolute", inset: 0 }}
      />
      <View className="gap-4 p-5">{children}</View>
    </View>
  );
}
