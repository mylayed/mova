import { Tabs } from 'expo-router/js-tabs';
import { House, UserRound } from 'lucide-react-native';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { t } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';

// Етап 1: лише Головна і Профіль; Граматика й Слова з'являться на етапі 2.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.cardBorder, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => <AnimatedIcon icon={House} color={String(color)} trigger={focused} animation="bounce" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => <AnimatedIcon icon={UserRound} color={String(color)} trigger={focused} animation="wiggle" />,
        }}
      />
    </Tabs>
  );
}
