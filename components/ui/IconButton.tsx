import { TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';

type IconButtonVariant = 'default' | 'filled' | 'outline' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface IconButtonProps extends TouchableOpacityProps {
  icon: keyof typeof Ionicons.glyphMap;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  iconColor?: string;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-background-secondary',
  filled: 'bg-accent',
  outline: 'bg-transparent border border-border',
  ghost: 'bg-transparent',
};

const sizeStyles: Record<IconButtonSize, { button: string; icon: number }> = {
  sm: { button: 'w-8 h-8', icon: 16 },
  md: { button: 'w-10 h-10', icon: 20 },
  lg: { button: 'w-12 h-12', icon: 24 },
  xl: { button: 'w-16 h-16', icon: 32 },
};

export const IconButton = forwardRef<View, IconButtonProps>(
  (
    {
      icon,
      variant = 'default',
      size = 'md',
      iconColor,
      disabled,
      className,
      ...touchableProps
    },
    ref
  ) => {
    const sizeStyle = sizeStyles[size];
    const defaultIconColor = variant === 'filled' ? '#FFFFFF' : '#000000';

    return (
      <TouchableOpacity
        ref={ref}
        disabled={disabled}
        activeOpacity={0.7}
        {...touchableProps}
        className={`
          items-center justify-center rounded-full
          ${variantStyles[variant]}
          ${sizeStyle.button}
          ${disabled ? 'opacity-50' : ''}
          ${className || ''}
        `}>
        <Ionicons
          name={icon}
          size={sizeStyle.icon}
          color={iconColor || defaultIconColor}
        />
      </TouchableOpacity>
    );
  }
);

IconButton.displayName = 'IconButton';
