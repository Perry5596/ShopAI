import { View, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SectionHeader } from './SectionHeader';
import { TimeRangeSelector } from './TimeRangeSelector';
import { EmptyState } from './EmptyState';
import { ChartCard } from './ChartCard';
import type { TimeSeriesPoint, TimeRange } from '@/hooks/useAnalyticsData';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32; // minus px-5 margins and card padding
const NUM_SECTIONS = 4;

interface SavingsChartProps {
  data: TimeSeriesPoint[];
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  totalSavings: number;
}

/**
 * Round a value up to a "nice" ceiling for chart y-axis labels.
 * e.g. 17 -> 20, 230 -> 250, 1400 -> 1500, 0 -> 10
 */
function niceMaxValue(raw: number, sections: number): number {
  if (raw <= 0) return sections * 5; // fallback: 0..20

  // Find the order of magnitude for the step
  const rawStep = raw / sections;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  // Round step up to the nearest 1, 2, or 5 multiple of magnitude
  const niceSteps = [1, 2, 5, 10];
  let step = magnitude;
  for (const ns of niceSteps) {
    if (ns * magnitude >= rawStep) {
      step = ns * magnitude;
      break;
    }
  }
  return Math.ceil(raw / step) * step;
}

export function SavingsChart({
  data,
  range,
  onRangeChange,
  totalSavings,
}: SavingsChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  // Determine how many labels to show based on data length
  const labelInterval = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 7 ? 2 : 1;

  const chartData = data.map((point, i) => ({
    value: point.value,
    label: i % labelInterval === 0 ? point.label : '',
    labelTextStyle: {
      color: '#9CA3AF',
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
    },
  }));

  // Compute a clean maxValue so the chart scales correctly
  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const maxValue = niceMaxValue(rawMax, NUM_SECTIONS);
  const stepValue = maxValue / NUM_SECTIONS;

  return (
    <ChartCard>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <SectionHeader
            title="Savings Over Time"
            subtitle={`$${totalSavings} total saved`}
          />
        </View>
        <View style={{ width: 180 }}>
          <TimeRangeSelector value={range} onChange={onRangeChange} />
        </View>
      </View>

      {hasData ? (
        <View style={{ marginLeft: -10 }}>
          <LineChart
            data={chartData}
            width={CHART_WIDTH}
            height={160}
            maxValue={maxValue}
            stepValue={stepValue}
            noOfSections={NUM_SECTIONS}
            spacing={Math.max(CHART_WIDTH / Math.max(chartData.length - 1, 1), 20)}
            initialSpacing={10}
            endSpacing={10}
            color="#22C55E"
            thickness={2.5}
            startFillColor="rgba(34, 197, 94, 0.2)"
            endFillColor="rgba(34, 197, 94, 0.01)"
            startOpacity={0.6}
            endOpacity={0}
            areaChart
            curved
            hideDataPoints={chartData.length > 20}
            dataPointsColor="#22C55E"
            dataPointsRadius={3}
            yAxisColor="transparent"
            xAxisColor="#E5E5EA"
            yAxisTextStyle={{
              color: '#9CA3AF',
              fontSize: 10,
              fontFamily: 'Inter_400Regular',
            }}
            hideRules
            yAxisLabelPrefix="$"
          />
        </View>
      ) : (
        <EmptyState
          icon="trending-up"
          message="Start scanning products to track your savings over time"
        />
      )}
    </ChartCard>
  );
}
