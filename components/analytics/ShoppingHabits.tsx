import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from './SectionHeader';
import { ChartCard } from './ChartCard';
import type { ShoppingHabitsData } from '@/hooks/useAnalyticsData';

interface ShoppingHabitsProps {
  data: ShoppingHabitsData;
  hasData: boolean;
}

interface HabitStatProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
}

function HabitStat({ icon, iconColor, value, label }: HabitStatProps) {
  return (
    <View className="flex-1 min-w-[45%] items-center py-3">
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text className="text-[22px] font-inter-bold text-foreground mt-1">
        {value}
      </Text>
      <Text className="text-[11px] font-inter text-foreground-muted text-center mt-0.5">
        {label}
      </Text>
    </View>
  );
}

export function ShoppingHabits({ data, hasData }: ShoppingHabitsProps) {
  if (!hasData) return null;

  return (
    <ChartCard>
      <SectionHeader title="Shopping Habits" subtitle="Patterns in your activity" />

      <View className="flex-row flex-wrap">
        <HabitStat
          icon="calendar"
          iconColor="#3B82F6"
          value={data.mostActiveDay}
          label="Most Active Day"
        />
        <HabitStat
          icon="layers"
          iconColor="#22C55E"
          value={`${data.avgProductsPerScan}`}
          label="Avg Products / Scan"
        />
        <HabitStat
          icon="checkmark-circle"
          iconColor="#A855F7"
          value={`${data.scanSuccessRate}%`}
          label="Scan Success Rate"
        />
        <HabitStat
          icon="heart"
          iconColor="#EF4444"
          value={`${data.favoriteRate}%`}
          label="Favorite Rate"
        />
      </View>
    </ChartCard>
  );
}
