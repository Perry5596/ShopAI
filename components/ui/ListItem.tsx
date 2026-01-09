import { View, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ListItemProps extends TouchableOpacityProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  isDestructive?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  showChevron = true,
  rightElement,
  isDestructive = false,
  isFirst = false,
  isLast = false,
  className,
  ...props
}: ListItemProps) {
  const textColor = isDestructive ? 'text-destructive' : 'text-foreground';
  const finalIconColor = iconColor || (isDestructive ? '#EF4444' : '#000000');

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className={`
        flex-row items-center py-4 px-4
        ${!isLast ? 'border-b border-border-light' : ''}
        ${className || ''}
      `}
      {...props}>
      {icon && (
        <View className="w-8 h-8 items-center justify-center mr-3">
          <Ionicons name={icon} size={22} color={finalIconColor} />
        </View>
      )}
      
      <View className="flex-1">
        <Text className={`text-[16px] font-medium ${textColor}`}>{title}</Text>
        {subtitle && (
          <Text className="text-[14px] text-foreground-muted mt-0.5">{subtitle}</Text>
        )}
      </View>

      {rightElement}
      
      {showChevron && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );
}
