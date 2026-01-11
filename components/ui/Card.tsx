import { View, ViewProps, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface PressableCardProps extends TouchableOpacityProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: 'bg-card',
  elevated: 'bg-card shadow-sm',
  outlined: 'bg-card border border-border',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={`
        rounded-2xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className || ''}
      `}
      {...props}>
      {children}
    </View>
  );
}

export function PressableCard({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: PressableCardProps) {
  const handlePress = (e: any) => {
    if (props.onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      props.onPress(e);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`
        rounded-2xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className || ''}
      `}
      {...props}
      onPress={handlePress}>
      {children}
    </TouchableOpacity>
  );
}
