import { Redirect } from "expo-router";
import { useAuth } from "../src/providers/auth-provider";

export default function RootIndex() {
  const { isReady, isAuthenticated, needsProfileSetup } = useAuth();

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    if (needsProfileSetup) {
      return <Redirect href="/(auth)/profile" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)" />;
}
