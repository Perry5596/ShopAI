import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TimeRange } from '@/hooks/useAnalyticsData';

const RANGES: TimeRange[] = ['7D', '30D', '90D', 'ALL'];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const handlePress = (range: TimeRange) => {
    if (range !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(range);
    }
  };

  return (
    <View className="flex-row bg-background-secondary rounded-xl p-1">
      {RANGES.map((range) => {
        const isActive = range === value;
        return (
          <TouchableOpacity
            key={range}
            activeOpacity={0.7}
            onPress={() => handlePress(range)}
            className={`flex-1 py-1.5 rounded-lg items-center ${
              isActive ? 'bg-card' : ''
            }`}
            style={
              isActive
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 1,
                  }
                : undefined
            }>
            <Text
              className={`text-[13px] ${
                isActive
                  ? 'font-inter-semibold text-foreground'
                  : 'font-inter text-foreground-muted'
              }`}>
              {range}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
