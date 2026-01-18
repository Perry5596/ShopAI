import { forwardRef } from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { button: string; text: string }> = {
  primary: {
    button: 'bg-accent',
    text: 'text-accent-foreground',
  },
  secondary: {
    button: 'bg-background-secondary',
    text: 'text-foreground',
  },
  outline: {
    button: 'bg-transparent border border-border',
    text: 'text-foreground',
  },
  ghost: {
    button: 'bg-transparent',
    text: 'text-foreground',
  },
  destructive: {
    button: 'bg-destructive',
    text: 'text-destructive-foreground',
  },
};

const sizeStyles: Record<ButtonSize, { button: string; text: string; icon: number }> = {
  sm: {
    button: 'py-2 px-4 rounded-xl',
    text: 'text-[14px]',
    icon: 16,
  },
  md: {
    button: 'py-3 px-6 rounded-2xl',
    text: 'text-[16px]',
    icon: 20,
  },
  lg: {
    button: 'py-4 px-6 rounded-2xl',
    text: 'text-[18px]',
    icon: 24,
  },
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      title,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      isLoading = false,
      fullWidth = false,
      disabled,
      className,
      ...touchableProps
    },
    ref
  ) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];
    const isDisabled = disabled || isLoading;

    const iconColor = variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : '#000000';

    const handlePress = (e: any) => {
      if (!isDisabled && touchableProps.onPress) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        touchableProps.onPress(e);
      }
    };

    return (
      <TouchableOpacity
        ref={ref}
        disabled={isDisabled}
        {...touchableProps}
        onPress={handlePress}
        className={`
          flex-row items-center justify-center
          ${variantStyle.button}
          ${sizeStyle.button}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-50' : ''}
          ${className || ''}
        `}
        style={[{ minWidth: 0 }, touchableProps.style]}>
        {isLoading ? (
          <ActivityIndicator color={iconColor} />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Ionicons
                name={icon}
                size={sizeStyle.icon}
                color={iconColor}
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              className={`
                font-inter-medium
                ${variantStyle.text}
                ${sizeStyle.text}
              `}
              style={{ flexShrink: 1 }}>
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons
                name={icon}
                size={sizeStyle.icon}
                color={iconColor}
                style={{ marginLeft: 8 }}
              />
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';
