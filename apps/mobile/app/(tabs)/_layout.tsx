import { Redirect, Tabs } from "expo-router";
import { BarChart3, Timer, UserRound } from "lucide-react-native";
import { useAuth } from "../../src/providers/auth-provider";
import { TabBar, useColors, type TabItem } from "../../src/design/taraz";

const items: Record<string, TabItem> = {
  index: { label: "Today", glyph: Timer },
  report: { label: "Report", glyph: BarChart3 },
  profile: { label: "Profile", glyph: UserRound },
};

function TabsNavigation() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surfaceApp },
      }}
      tabBar={(props) => <TabBar {...props} items={items} />}
    >
      <Tabs.Screen name="index" options={{ title: items.index.label }} />
      <Tabs.Screen name="report" options={{ title: items.report.label }} />
      <Tabs.Screen name="profile" options={{ title: items.profile.label }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { isReady, isAuthenticated, needsProfileSetup } = useAuth();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (needsProfileSetup) {
    return <Redirect href="/(auth)/profile" />;
  }

  return <TabsNavigation />;
}
