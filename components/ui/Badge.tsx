import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type BadgeVariant = 'default' | 'premium' | 'success' | 'warning' | 'destructive';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; iconColor: string }> = {
  default: {
    bg: 'bg-background-secondary',
    text: 'text-foreground-muted',
    iconColor: '#6B7280',
  },
  premium: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    iconColor: '#B45309',
  },
  success: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    iconColor: '#15803D',
  },
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    iconColor: '#A16207',
  },
  destructive: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    iconColor: '#B91C1C',
  },
};

export function Badge({ text, variant = 'default', icon, className }: BadgeProps) {
  const style = variantStyles[variant];

  return (
    <View
      className={`
        flex-row items-center px-2 py-1 rounded-full
        ${style.bg}
        ${className || ''}
      `}>
      {icon && (
        <Ionicons
          name={icon}
          size={12}
          color={style.iconColor}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={`text-[12px] font-medium ${style.text}`}>{text}</Text>
    </View>
  );
}
