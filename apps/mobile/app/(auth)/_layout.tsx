import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { motion } from "../../src/design/taraz";

export default function AuthLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "none" : "fade",
        animationDuration: motion.durFast,
      }}
    />
  );
}
