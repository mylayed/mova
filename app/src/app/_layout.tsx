import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
  useFonts,
} from '@expo-google-fonts/onest';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Вхід → вибір мови й рівня → основний застосунок.
function RootNavigator() {
  const { session, loading, activeLanguage } = useSession();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const signedIn = Boolean(session);
  const onboarded = Boolean(activeLanguage);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="topics" />
        <Stack.Screen name="conversation" options={{ gestureEnabled: false }} />
        <Stack.Screen name="summary/[id]" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
