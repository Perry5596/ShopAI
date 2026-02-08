import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface TypingIndicatorProps {
  /** Optional status text to display (e.g., "Searching 4 categories...") */
  statusText?: string | null;
}

/**
 * Animated typing indicator (3 bouncing dots) shown while the AI is thinking.
 * Optionally displays a status text from the streaming agent.
 */
export function TypingIndicator({ statusText }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

    const animation = Animated.parallel([
      createBounce(dot1, 0),
      createBounce(dot2, 150),
      createBounce(dot3, 300),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center self-start ml-4 mb-3">
      <View className="flex-row items-center bg-background-secondary rounded-2xl rounded-bl-sm px-4 py-3">
        {[dot1, dot2, dot3].map((dot, index) => (
          <Animated.View
            key={index}
            style={{ transform: [{ translateY: dot }] }}
            className={`w-2 h-2 rounded-full bg-foreground-muted ${index < 2 ? 'mr-1.5' : ''}`}
          />
        ))}
      </View>
      {statusText ? (
        <Text className="text-[13px] font-inter text-foreground-muted ml-2.5">
          {statusText}
        </Text>
      ) : null}
    </View>
  );
}
