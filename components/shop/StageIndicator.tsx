import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionStatus } from '@/types';

interface StageIndicatorProps {
  status: SessionStatus;
  productName?: string;
}

interface Stage {
  key: SessionStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STAGES: Stage[] = [
  { key: 'identifying', label: 'Identifying', icon: 'eye-outline' },
  { key: 'searching', label: 'Searching', icon: 'search-outline' },
  { key: 'ranking', label: 'Ranking', icon: 'trophy-outline' },
  { key: 'completed', label: 'Done', icon: 'checkmark-circle' },
];

function getStageIndex(status: SessionStatus): number {
  if (status === 'failed') return -1;
  return STAGES.findIndex((s) => s.key === status);
}

export function StageIndicator({ status, productName }: StageIndicatorProps) {
  const currentIndex = getStageIndex(status);

  if (status === 'failed') {
    return (
      <View className="px-5 py-4">
        <View className="flex-row items-center justify-center">
          <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
          </View>
          <Text className="ml-3 text-[16px] font-inter-medium text-red-600">
            Analysis Failed
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="px-5 py-4">
      {/* Product name if available */}
      {productName && (
        <Text className="text-[18px] font-inter-semibold text-foreground text-center mb-4">
          {productName}
        </Text>
      )}

      {/* Stage indicators */}
      <View className="flex-row items-center justify-center">
        {STAGES.map((stage, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <View key={stage.key} className="flex-row items-center">
              {/* Connector line */}
              {index > 0 && (
                <View
                  className={`w-8 h-0.5 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}

              {/* Stage circle */}
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isCompleted
                    ? 'bg-green-500'
                    : isActive
                    ? 'bg-foreground'
                    : 'bg-gray-200'
                }`}
              >
                <Ionicons
                  name={isCompleted ? 'checkmark' : stage.icon}
                  size={20}
                  color={isCompleted || isActive ? '#FFFFFF' : '#9CA3AF'}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Current stage label */}
      <Text className="text-[14px] font-inter text-foreground-muted text-center mt-3">
        {status === 'completed'
          ? 'Search complete'
          : STAGES[currentIndex]?.label || 'Processing...'}
      </Text>
    </View>
  );
}
