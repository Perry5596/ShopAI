import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedReaction, withTiming, Easing, runOnJS } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  textColor?: string;
  duration?: number; // Duration in milliseconds
  startTime?: string; // ISO timestamp when processing started
}

export function CircularProgress({
  size = 60,
  strokeWidth = 4,
  color = '#000000',
  backgroundColor = '#E5E7EB',
  textColor = '#000000',
  duration = 10000, // 10 seconds default
  startTime,
}: CircularProgressProps) {
  const [progress, setProgress] = useState(0);
  const progressValue = useSharedValue(0);

  // Update progress based on elapsed time when startTime is provided
  useEffect(() => {
    if (!startTime) {
      // No startTime: animate from 0 to 100
      progressValue.value = 0;
      setProgress(0);
      progressValue.value = withTiming(100, {
        duration,
        easing: Easing.linear,
      });
      return;
    }

    // With startTime: calculate progress based on elapsed time
    const updateProgress = () => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const elapsed = now - start;
      const currentProgress = Math.min((elapsed / duration) * 100, 100);
      
      progressValue.value = currentProgress;
      setProgress(Math.round(currentProgress));
    };

    // Update immediately
    updateProgress();

    // Update every 100ms for smooth display
    const interval = setInterval(updateProgress, 100);

    return () => clearInterval(interval);
  }, [duration, startTime, progressValue]);

  // Update progress text based on animated value
  useAnimatedReaction(
    () => progressValue.value,
    (value) => {
      runOnJS(setProgress)(Math.round(value));
    }
  );

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (progressValue.value / 100) * circumference;
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          animatedProps={animatedProps}
        />
      </Svg>
      {/* Percentage text */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text
          style={{
            fontSize: size * 0.25,
            fontWeight: '600',
            color: textColor,
          }}>
          {progress}%
        </Text>
      </View>
    </View>
  );
}
