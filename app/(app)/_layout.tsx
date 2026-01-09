import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="snap"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="fix-issue/[id]" />
    </Stack>
  );
}
