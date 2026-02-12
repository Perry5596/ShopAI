import { View, Text } from 'react-native';
import { SectionHeader } from './SectionHeader';
import { ChartCard } from './ChartCard';
import type { CategoryCount } from '@/hooks/useAnalyticsData';

interface CategoryInsightsProps {
  data: CategoryCount[];
}

const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#C084FC', '#D946EF'];

export function CategoryInsights({ data }: CategoryInsightsProps) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ChartCard>
      <SectionHeader title="Category Insights" subtitle="Most searched product categories" />

      <View className="gap-3">
        {data.map((item, index) => {
          const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <View key={item.category}>
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  className="text-[13px] font-inter-medium text-foreground flex-1"
                  numberOfLines={1}>
                  {item.category}
                </Text>
                <Text className="text-[13px] font-inter-semibold text-foreground-muted ml-2">
                  {item.count}
                </Text>
              </View>
              <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(widthPercent, 4)}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </ChartCard>
  );
}
