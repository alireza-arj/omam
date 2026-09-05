import { Redirect, Tabs } from "expo-router";
import { BarChart3, Timer, UserRound } from "lucide-react-native";
import { useAuth } from "../../src/providers/auth-provider";
import { TabBar, useColors, useTranslation, type TabItem } from "../../src/design/taraz";

function TabsNavigation() {
  const colors = useColors();
  const t = useTranslation();

  const items: Record<string, TabItem> = {
    index: { label: t("tabs.today"), glyph: Timer },
    report: { label: t("tabs.report"), glyph: BarChart3 },
    profile: { label: t("tabs.profile"), glyph: UserRound },
  };

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
