import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

export function ScreenShell({ children }: PropsWithChildren) {
  return (
    <SafeAreaView className="flex-1 bg-night" edges={["top"]}>
      <LinearGradient
        colors={["#08111f", "#10203b", "#08111f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        className="absolute rounded-full bg-sky/10"
        style={{
          left: -60,
          top: 64,
          width: 224,
          height: 224,
        }}
      />
      <View
        className="absolute rounded-full bg-coral/10"
        style={{
          right: -40,
          top: 208,
          width: 192,
          height: 192,
        }}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 140,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
