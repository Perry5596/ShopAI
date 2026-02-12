import { View, Text } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { ChartCard } from './ChartCard';
import type { RetailerSlice } from '@/hooks/useAnalyticsData';

interface RetailerBreakdownProps {
  data: RetailerSlice[];
}

export function RetailerBreakdown({ data }: RetailerBreakdownProps) {
  if (data.length === 0) {
    return (
      <ChartCard>
        <SectionHeader title="Retailer Breakdown" subtitle="Where your products come from" />
        <EmptyState icon="storefront" message="Products from different retailers will be shown here" />
      </ChartCard>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  const pieData = data.map((slice) => ({
    value: slice.count,
    color: slice.color,
    text: `${Math.round((slice.count / total) * 100)}%`,
    textColor: '#FFFFFF',
    textSize: 11,
  }));

  return (
    <ChartCard>
      <SectionHeader title="Retailer Breakdown" subtitle="Where your products come from" />

      <View className="flex-row items-center">
        {/* Donut chart */}
        <View className="items-center justify-center" style={{ width: 150, height: 150 }}>
          <PieChart
            data={pieData}
            donut
            radius={65}
            innerRadius={40}
            innerCircleColor="#FFFFFF"
            centerLabelComponent={() => (
              <View className="items-center">
                <Text className="text-[18px] font-inter-bold text-foreground">
                  {total}
                </Text>
                <Text className="text-[10px] font-inter text-foreground-muted">
                  products
                </Text>
              </View>
            )}
          />
        </View>

        {/* Legend */}
        <View className="flex-1 ml-4 gap-2">
          {data.map((slice) => (
            <View key={slice.name} className="flex-row items-center">
              <View
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: slice.color }}
              />
              <Text
                className="text-[13px] font-inter text-foreground flex-1"
                numberOfLines={1}>
                {slice.name}
              </Text>
              <Text className="text-[13px] font-inter-medium text-foreground-muted ml-2">
                {slice.count}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ChartCard>
  );
}
