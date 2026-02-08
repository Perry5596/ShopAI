import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchProductCard } from './SearchProductCard';
import type { SearchCategory } from '@/types';

interface CategorySectionProps {
  category: SearchCategory;
  onLinkClick?: () => void;
}

/**
 * A single category section: label, description, and horizontal product carousel.
 */
export function CategorySection({ category, onLinkClick }: CategorySectionProps) {
  return (
    <View className="mb-5">
      {/* Category Header */}
      <View className="px-4 mb-2">
        <View className="flex-row items-center mb-1">
          <Ionicons name="pricetag-outline" size={14} color="#6B7280" />
          <Text className="text-[15px] font-inter-semibold text-foreground ml-1.5">
            {category.label}
          </Text>
        </View>
        {category.description ? (
          <Text className="text-[13px] text-foreground-muted leading-snug">
            {category.description}
          </Text>
        ) : null}
      </View>

      {/* Product Carousel */}
      {category.products.length > 0 ? (
        <FlatList
          horizontal
          data={category.products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchProductCard product={item} onLinkClick={onLinkClick} />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      ) : (
        <View className="px-4 py-4 items-center">
          <Text className="text-[13px] text-foreground-muted">
            No products found for this category
          </Text>
        </View>
      )}
    </View>
  );
}
