import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { GradientButton, T } from '@/components/web';
import { Brand, C, Spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { checkForcedUpdate } from '@/lib/version';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, me } = useAuth();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [mustUpdate, setMustUpdate] = useState(false);

  useEffect(() => {
    checkForcedUpdate().then(setMustUpdate);
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) return null;
  if (mustUpdate) return <ForceUpdate />;

  const signedIn = !!me;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="reminders" options={{ presentation: 'modal', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}

function ForceUpdate() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.four, backgroundColor: C.pageBg }}>
      <T size={26} weight="semibold" color={C.slate900}>Update required</T>
      <T size={15} color={C.slate500}>This version of ClassMate is no longer supported. Please update to keep using the app.</T>
      {/* TODO(app store): replace with the real App Store id once the listing exists */}
      <GradientButton title="Open App Store" size="lg" onPress={() => Linking.openURL('itms-apps://apps.apple.com/app/classmate')} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Brand, background: C.pageBg } }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
