import { View, Text } from 'react-native';
import { SectionHeader } from './SectionHeader';
import { ChartCard } from './ChartCard';
import type { BrandCount } from '@/hooks/useAnalyticsData';

interface TopBrandsProps {
  data: BrandCount[];
}

const BAR_COLORS = [
  '#000000',
  '#374151',
  '#4B5563',
  '#6B7280',
  '#9CA3AF',
  '#D1D5DB',
  '#E5E7EB',
  '#F3F4F6',
];

export function TopBrands({ data }: TopBrandsProps) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ChartCard>
      <SectionHeader title="Top Brands" subtitle="Most frequently found brands" />

      <View className="gap-3">
        {data.map((item, index) => {
          const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <View key={item.brand}>
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  className="text-[13px] font-inter-medium text-foreground flex-1"
                  numberOfLines={1}>
                  {item.brand}
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
                    backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
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
