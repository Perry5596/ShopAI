import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface EmptySearchProps {
  onSuggestionPress: (query: string) => void;
}

const SUGGESTIONS = [
  { label: 'Protein Powder', icon: 'fitness-outline' as const },
  { label: 'Wireless Earbuds', icon: 'headset-outline' as const },
  { label: 'Running Shoes', icon: 'walk-outline' as const },
  { label: 'Standing Desk', icon: 'desktop-outline' as const },
  { label: 'Air Fryer', icon: 'flame-outline' as const },
  { label: 'Backpack', icon: 'bag-outline' as const },
];

/**
 * Empty state shown when the user hasn't started a search yet.
 * Shows a welcome message and suggested product queries.
 */
export function EmptySearch({ onSuggestionPress }: EmptySearchProps) {
  const handlePress = (query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSuggestionPress(query);
  };

  return (
    <View className="flex-1 justify-center px-6">
      {/* Icon */}
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
          <Ionicons name="sparkles" size={28} color="#6B7280" />
        </View>
        <Text className="text-[20px] font-inter-semibold text-foreground text-center mb-2">
          What are you looking for?
        </Text>
        <Text className="text-[14px] text-foreground-muted text-center leading-snug">
          Describe a product and our AI will find the best options across different categories.
        </Text>
      </View>

      {/* Suggestions */}
      <Text className="text-[13px] font-inter-medium text-foreground-muted mb-3 ml-1">
        Try searching for
      </Text>
      <View className="flex-row flex-wrap">
        {SUGGESTIONS.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.label}
            onPress={() => handlePress(suggestion.label)}
            activeOpacity={0.7}
            className="flex-row items-center mr-2 mb-2 px-4 py-2.5 rounded-full border border-border"
            style={{ backgroundColor: '#FAFAFA' }}>
            <Ionicons name={suggestion.icon} size={16} color="#6B7280" />
            <Text className="text-[14px] text-foreground font-inter-medium ml-2">
              {suggestion.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
