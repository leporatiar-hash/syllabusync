import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button, Text } from '@/components/ui';
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
        <Stack.Screen name="signup" options={{ headerShown: true, title: 'Create account', headerBackTitle: 'Back' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: true, title: 'Reset password', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

function ForceUpdate() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.five, gap: Spacing.four }}>
      <Text variant="title">Update required</Text>
      <Text variant="secondary">This version of ClassMate is no longer supported. Please update to keep using the app.</Text>
      {/* TODO(app store): replace with the real App Store id once the listing exists */}
      <Button title="Open App Store" onPress={() => Linking.openURL('itms-apps://apps.apple.com/app/classmate')} />
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
