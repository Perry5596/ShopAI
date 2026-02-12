import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HeroStatsData } from '@/hooks/useAnalyticsData';

interface HeroStatsProps {
  stats: HeroStatsData;
}

interface StatPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
}

function StatPill({ icon, iconColor, iconBg, value, label }: StatPillProps) {
  return (
    <View
      className="flex-1 bg-card rounded-2xl p-3 items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}>
      <View
        className="w-9 h-9 rounded-full items-center justify-center mb-2"
        style={{ backgroundColor: iconBg }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text className="text-[20px] font-inter-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[11px] font-inter text-foreground-muted mt-0.5" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}m`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

export function HeroStats({ stats }: HeroStatsProps) {
  return (
    <View className="px-5 mb-4">
      <View className="flex-row gap-2">
        <StatPill
          icon="flame"
          iconColor="#F59E0B"
          iconBg="#FEF3C7"
          value={`${stats.currentStreak}`}
          label="Day Streak"
        />
        <StatPill
          icon="cash"
          iconColor="#22C55E"
          iconBg="#DCFCE7"
          value={`$${formatNumber(stats.totalSavings)}`}
          label="Saved"
        />
        <StatPill
          icon="scan"
          iconColor="#3B82F6"
          iconBg="#DBEAFE"
          value={formatNumber(stats.totalScans)}
          label="Scans"
        />
        <StatPill
          icon="open"
          iconColor="#A855F7"
          iconBg="#F3E8FF"
          value={formatNumber(stats.linkClicks)}
          label="Clicks"
        />
      </View>
    </View>
  );
}
