import { View, Text } from 'react-native';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View className="mb-3">
      <Text className="text-[17px] font-inter-semibold text-foreground">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-[13px] font-inter text-foreground-muted mt-0.5">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
