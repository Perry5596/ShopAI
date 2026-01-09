import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen
        name="sign-in"
        options={{
          presentation: 'transparentModal',
        }}
      />
    </Stack>
  );
}
