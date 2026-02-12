import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from './SectionHeader';
import { ChartCard } from './ChartCard';
import type { EngagementFunnelData } from '@/hooks/useAnalyticsData';

interface EngagementFunnelProps {
  data: EngagementFunnelData;
}

interface FunnelStepProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  widthPercent: number;
  barColor: string;
  isLast?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}m`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function FunnelStep({
  icon,
  iconColor,
  label,
  value,
  widthPercent,
  barColor,
}: FunnelStepProps) {
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center flex-1">
          <Ionicons name={icon} size={16} color={iconColor} />
          <Text className="text-[13px] font-inter text-foreground ml-2">
            {label}
          </Text>
        </View>
        <Text className="text-[15px] font-inter-semibold text-foreground">
          {formatNumber(value)}
        </Text>
      </View>
      <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.max(widthPercent, 2)}%`,
            backgroundColor: barColor,
          }}
        />
      </View>
    </View>
  );
}

export function EngagementFunnel({ data }: EngagementFunnelProps) {
  const maxValue = Math.max(data.scans, data.productsFound, data.linksClicked, data.itemsSaved, 1);

  // If no engagement at all, don't render
  if (data.scans === 0 && data.productsFound === 0) return null;

  return (
    <ChartCard>
      <SectionHeader
        title="Engagement Funnel"
        subtitle="From discovery to action"
      />

      <FunnelStep
        icon="scan"
        iconColor="#3B82F6"
        label="Scans & Searches"
        value={data.scans}
        widthPercent={(data.scans / maxValue) * 100}
        barColor="#3B82F6"
      />
      <FunnelStep
        icon="cube"
        iconColor="#22C55E"
        label="Products Found"
        value={data.productsFound}
        widthPercent={(data.productsFound / maxValue) * 100}
        barColor="#22C55E"
      />
      <FunnelStep
        icon="open"
        iconColor="#A855F7"
        label="Links Clicked"
        value={data.linksClicked}
        widthPercent={(data.linksClicked / maxValue) * 100}
        barColor="#A855F7"
      />
      <FunnelStep
        icon="heart"
        iconColor="#EF4444"
        label="Items Saved"
        value={data.itemsSaved}
        widthPercent={(data.itemsSaved / maxValue) * 100}
        barColor="#EF4444"
      />
    </ChartCard>
  );
}
