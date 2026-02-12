import { View, Text, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SectionHeader } from './SectionHeader';
import { TimeRangeSelector } from './TimeRangeSelector';
import { EmptyState } from './EmptyState';
import { ChartCard } from './ChartCard';
import type { StackedTimeSeriesPoint, TimeRange } from '@/hooks/useAnalyticsData';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32;

interface ActivityChartProps {
  data: StackedTimeSeriesPoint[];
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

export function ActivityChart({
  data,
  range,
  onRangeChange,
}: ActivityChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.scans > 0 || d.searches > 0);
  const totalScans = data.reduce((sum, d) => sum + d.scans, 0);
  const totalSearches = data.reduce((sum, d) => sum + d.searches, 0);

  // Compute bar sizing
  const numBars = Math.max(data.length, 1);
  const slotWidth = CHART_WIDTH / numBars;
  const barWidth = Math.max(Math.min(slotWidth * 0.6, 24), 6);
  const spacing = Math.max(slotWidth - barWidth, 2);

  // Labels need at least ~36px to render a date like "12/31" without clipping.
  // Calculate how many slots apart labels must be so they don't overlap.
  const MIN_LABEL_WIDTH = 36;
  const labelInterval = Math.max(Math.ceil(MIN_LABEL_WIDTH / slotWidth), 1);

  // Build stacked bar data
  const stackData = data.map((point, i) => ({
    stacks: [
      {
        value: point.scans,
        color: '#000000',
      },
      {
        value: point.searches,
        color: '#3B82F6',
        marginBottom: point.scans > 0 ? 1 : 0,
      },
    ],
    label: i % labelInterval === 0 ? point.label : '',
    labelTextStyle: {
      color: '#9CA3AF',
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center' as const,
    },
  }));

  return (
    <ChartCard>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <SectionHeader title="Activity" />
        </View>
        <View style={{ width: 180 }}>
          <TimeRangeSelector value={range} onChange={onRangeChange} />
        </View>
      </View>

      {/* Legend */}
      <View className="flex-row items-center mb-3 gap-4">
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-sm bg-foreground mr-1.5" />
          <Text className="text-[12px] font-inter text-foreground-muted">
            Scans ({totalScans})
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-sm mr-1.5" style={{ backgroundColor: '#3B82F6' }} />
          <Text className="text-[12px] font-inter text-foreground-muted">
            Searches ({totalSearches})
          </Text>
        </View>
      </View>

      {hasData ? (
        <View style={{ marginLeft: -10 }}>
          <BarChart
            stackData={stackData}
            width={CHART_WIDTH}
            height={140}
            barWidth={barWidth}
            spacing={spacing}
            initialSpacing={spacing / 2}
            endSpacing={spacing / 2}
            labelWidth={Math.max(slotWidth, MIN_LABEL_WIDTH)}
            yAxisColor="transparent"
            xAxisColor="#E5E5EA"
            yAxisTextStyle={{
              color: '#9CA3AF',
              fontSize: 10,
              fontFamily: 'Inter_400Regular',
            }}
            hideRules
            noOfSections={4}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
          />
        </View>
      ) : (
        <EmptyState
          icon="bar-chart"
          message="Your scan and search activity will appear here"
        />
      )}
    </ChartCard>
  );
}
