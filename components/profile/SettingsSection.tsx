import { View, Text } from 'react-native';
import { ListItem } from '../ui/ListItem';
import { Card } from '../ui/Card';
import type { SettingsItem } from '@/types';
import { Ionicons } from '@expo/vector-icons';

interface SettingsSectionProps {
  title: string;
  items: SettingsItem[];
}

export function SettingsSection({ title, items }: SettingsSectionProps) {
  return (
    <View className="mb-6">
      <Text className="text-[14px] font-inter-medium text-foreground-muted mb-2 px-1">
        {title}
      </Text>
      <Card 
        variant="default" 
        padding="none" 
        className="overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        }}>
        {items.map((item, index) => (
          <ListItem
            key={item.id}
            icon={item.icon as keyof typeof Ionicons.glyphMap}
            title={item.title}
            subtitle={item.subtitle}
            isDestructive={item.isDestructive}
            showChevron={item.showChevron !== false}
            rightElement={item.rightElement}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onPress={item.onPress}
          />
        ))}
      </Card>
    </View>
  );
}
