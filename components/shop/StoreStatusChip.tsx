import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StoreStatus } from '@/types';

interface StoreStatusChipProps {
  source: string;
  status: StoreStatus;
  resultCount?: number;
}

const STATUS_CONFIG: Record<
  StoreStatus,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }
> = {
  pending: { icon: 'ellipse', color: '#9CA3AF', bgColor: 'bg-gray-100' },
  success: { icon: 'checkmark-circle', color: '#10B981', bgColor: 'bg-green-50' },
  timeout: { icon: 'time-outline', color: '#F59E0B', bgColor: 'bg-yellow-50' },
  error: { icon: 'close-circle', color: '#EF4444', bgColor: 'bg-red-50' },
};

const SOURCE_NAMES: Record<string, string> = {
  amazon: 'Amazon',
  target: 'Target',
  walmart: 'Walmart',
  bestbuy: 'Best Buy',
  ebay: 'eBay',
};

export function StoreStatusChip({ source, status, resultCount }: StoreStatusChipProps) {
  const config = STATUS_CONFIG[status];
  const displayName = SOURCE_NAMES[source] || source;

  return (
    <View
      className={`flex-row items-center px-3 py-1.5 rounded-full ${config.bgColor} mr-2 mb-2`}
    >
      {status === 'pending' ? (
        <View className="w-2 h-2 rounded-full bg-gray-400 mr-2 animate-pulse" />
      ) : (
        <Ionicons name={config.icon} size={14} color={config.color} />
      )}
      <Text
        className="text-[12px] font-inter-medium ml-1"
        style={{ color: config.color }}
      >
        {displayName}
        {status === 'success' && resultCount !== undefined && ` (${resultCount})`}
      </Text>
    </View>
  );
}

interface StoreStatusRowProps {
  stores: Array<{
    source: string;
    status: StoreStatus;
    resultCount?: number;
  }>;
}

export function StoreStatusRow({ stores }: StoreStatusRowProps) {
  if (!stores || stores.length === 0) return null;

  return (
    <View className="px-5 py-2">
      <Text className="text-[12px] font-inter text-foreground-muted mb-2">
        Searching stores:
      </Text>
      <View className="flex-row flex-wrap">
        {stores.map((store) => (
          <StoreStatusChip
            key={store.source}
            source={store.source}
            status={store.status}
            resultCount={store.resultCount}
          />
        ))}
      </View>
    </View>
  );
}
