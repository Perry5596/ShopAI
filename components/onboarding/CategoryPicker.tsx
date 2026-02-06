import { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { shoppingCategories, type ShoppingCategory } from '@/constants/shopping-categories';

interface CategoryPickerProps {
  selectedIds: string[];
  onToggle: (ids: string[]) => void;
}

export function CategoryPicker({ selectedIds, onToggle }: CategoryPickerProps) {
  const handleToggle = useCallback(
    (category: ShoppingCategory) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (selectedIds.includes(category.id)) {
        onToggle(selectedIds.filter((id) => id !== category.id));
      } else {
        onToggle([...selectedIds, category.id]);
      }
    },
    [selectedIds, onToggle]
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
        {shoppingCategories.map((category) => {
          const isSelected = selectedIds.includes(category.id);
          return (
            <TouchableOpacity
              key={category.id}
              activeOpacity={0.7}
              onPress={() => handleToggle(category)}
              className={`
                flex-row items-center rounded-2xl px-4 py-3 border
                ${
                  isSelected
                    ? 'bg-foreground border-foreground'
                    : 'bg-background border-border'
                }
              `}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isSelected ? 0.1 : 0.04,
                shadowRadius: 3,
                elevation: isSelected ? 3 : 1,
              }}>
              <Ionicons
                name={category.icon as any}
                size={18}
                color={isSelected ? '#FFFFFF' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`text-[15px] font-inter-medium ${
                  isSelected ? 'text-white' : 'text-foreground'
                }`}>
                {category.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
