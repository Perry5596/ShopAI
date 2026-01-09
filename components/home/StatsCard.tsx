import { View, Text, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PressableCard } from '../ui/Card';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40; // Full width minus padding

interface StatsCardProps {
  totalShops: number;
  totalProducts: number;
  favorites: number;
  thisWeek: number;
  onPress?: () => void;
}

// Circular progress component
function CircularProgress({
  progress,
  size = 60,
  strokeWidth = 6,
  color = '#000000',
  backgroundColor = '#E5E5EA',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export function StatsCard({
  totalShops,
  totalProducts,
  favorites,
  thisWeek,
  onPress,
}: StatsCardProps) {
  // Calculate a mock "progress" for visual effect
  const shopProgress = Math.min((totalShops / 50) * 100, 100);

  return (
    <PressableCard
      variant="elevated"
      padding="lg"
      className="mx-5 mb-4"
      style={{ width: CARD_WIDTH }}
      onPress={onPress}>
      <View className="flex-row items-center justify-between">
        {/* Left side - Main stat */}
        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text className="text-[48px] font-inter-semibold text-foreground">{totalShops}</Text>
            <Text className="text-[16px] font-inter text-foreground-muted ml-1">shops</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Text className="text-[14px] font-inter text-foreground-muted">Total scans</Text>
            <View className="flex-row items-center ml-2 bg-green-100 px-2 py-0.5 rounded-full">
              <Text className="text-[12px] font-inter-medium text-green-600">+{thisWeek}</Text>
            </View>
          </View>
        </View>

        {/* Right side - Circular progress */}
        <View className="items-center">
          <CircularProgress progress={shopProgress} size={70} strokeWidth={8} />
          <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
            <Ionicons name="bag" size={24} color="#000000" />
          </View>
        </View>
      </View>
    </PressableCard>
  );
}

interface MiniStatsRowProps {
  favorites: number;
  products: number;
  savings: number;
}

export function MiniStatsRow({ favorites, products, savings }: MiniStatsRowProps) {
  return (
    <View className="flex-row mx-5 mb-4 space-x-3">
      {/* Favorites */}
      <View 
        className="flex-1 bg-card rounded-2xl p-4 items-center"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}>
        <View className="relative mb-2">
          <CircularProgress 
            progress={Math.min((favorites / 20) * 100, 100)} 
            size={50} 
            strokeWidth={5}
            color="#EF4444"
            backgroundColor="#FEE2E2"
          />
          <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
            <Ionicons name="heart" size={18} color="#EF4444" />
          </View>
        </View>
        <Text className="text-[20px] font-inter-semibold text-foreground">{favorites}</Text>
        <Text className="text-[12px] font-inter text-foreground-muted">Favorites</Text>
      </View>

      {/* Products Found */}
      <View 
        className="flex-1 bg-card rounded-2xl p-4 items-center ml-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}>
        <View className="relative mb-2">
          <CircularProgress 
            progress={Math.min((products / 100) * 100, 100)} 
            size={50} 
            strokeWidth={5}
            color="#3B82F6"
            backgroundColor="#DBEAFE"
          />
          <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
            <Ionicons name="link" size={18} color="#3B82F6" />
          </View>
        </View>
        <Text className="text-[20px] font-inter-semibold text-foreground">{products}</Text>
        <Text className="text-[12px] font-inter text-foreground-muted">Products</Text>
      </View>

      {/* Potential Savings */}
      <View 
        className="flex-1 bg-card rounded-2xl p-4 items-center ml-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}>
        <View className="relative mb-2">
          <CircularProgress 
            progress={65} 
            size={50} 
            strokeWidth={5}
            color="#22C55E"
            backgroundColor="#DCFCE7"
          />
          <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
            <Ionicons name="trending-up" size={18} color="#22C55E" />
          </View>
        </View>
        <Text className="text-[20px] font-inter-semibold text-foreground">${savings}</Text>
        <Text className="text-[12px] font-inter text-foreground-muted">Saved</Text>
      </View>
    </View>
  );
}
