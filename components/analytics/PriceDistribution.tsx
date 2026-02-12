import { View, Text, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { ChartCard } from './ChartCard';
import type { PriceBucket } from '@/hooks/useAnalyticsData';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32;

interface PriceDistributionProps {
  data: PriceBucket[];
}

const BAR_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#C084FC'];

export function PriceDistribution({ data }: PriceDistributionProps) {
  const hasData = data.some((d) => d.count > 0);
  const totalProducts = data.reduce((sum, d) => sum + d.count, 0);

  if (!hasData) {
    return (
      <ChartCard>
        <SectionHeader title="Price Distribution" subtitle="Products by price range" />
        <EmptyState icon="pricetag" message="Price ranges will appear as you discover more products" />
      </ChartCard>
    );
  }

  // Evenly divide chart width among 5 bars
  const numBars = data.length;
  const slotWidth = CHART_WIDTH / numBars;
  const barWidth = Math.min(slotWidth * 0.55, 40);
  const spacing = slotWidth - barWidth;

  const barData = data.map((bucket, i) => ({
    value: bucket.count,
    label: bucket.label,
    frontColor: BAR_COLORS[i % BAR_COLORS.length],
    labelTextStyle: {
      color: '#9CA3AF',
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center' as const,
    },
    topLabelComponent: () =>
      bucket.count > 0 ? (
        <Text
          style={{
            color: '#6B7280',
            fontSize: 11,
            fontFamily: 'Inter_600SemiBold',
            marginBottom: 2,
          }}>
          {bucket.count}
        </Text>
      ) : null,
  }));

  return (
    <ChartCard>
      <SectionHeader
        title="Price Distribution"
        subtitle={`${totalProducts} products with price data`}
      />
      <View style={{ marginLeft: -10 }}>
        <BarChart
          data={barData}
          width={CHART_WIDTH}
          height={140}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={spacing / 2}
          endSpacing={spacing / 2}
          labelWidth={slotWidth}
          yAxisColor="transparent"
          xAxisColor="#E5E5EA"
          yAxisTextStyle={{
            color: '#9CA3AF',
            fontSize: 10,
            fontFamily: 'Inter_400Regular',
          }}
          hideRules
          noOfSections={4}
          barBorderTopLeftRadius={6}
          barBorderTopRightRadius={6}
        />
      </View>
    </ChartCard>
  );
}
