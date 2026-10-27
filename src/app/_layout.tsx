import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ink } from '../theme';

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: ink.stage },
          headerTintColor: ink.paper,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: ink.stage },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="song/[id]" options={{ title: '' }} />
        <Stack.Screen name="sing/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}
