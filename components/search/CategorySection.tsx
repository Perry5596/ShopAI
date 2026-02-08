import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchProductCard } from './SearchProductCard';
import type { SearchCategory } from '@/types';

interface CategorySectionProps {
  category: SearchCategory;
  /** AI recommendation for this category */
  recommendation?: { productTitle: string; reason: string };
  onLinkClick?: () => void;
  /** Called when user saves/unsaves a product via long-press */
  onSaveProduct?: (productId: string) => Promise<boolean>;
}

/**
 * A single category section: label, description, optional AI pick, and
 * horizontal product carousel.
 */
export function CategorySection({ category, recommendation, onLinkClick, onSaveProduct }: CategorySectionProps) {
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
          data={(() => {
            // Move the AI-recommended product to the front of the list
            if (!recommendation) return category.products;
            const needle = recommendation.productTitle.toLowerCase().substring(0, 30);
            const recIdx = category.products.findIndex((p) =>
              p.title.toLowerCase().includes(needle)
            );
            if (recIdx <= 0) return category.products; // already first or not found
            const sorted = [...category.products];
            const [picked] = sorted.splice(recIdx, 1);
            sorted.unshift(picked);
            return sorted;
          })()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchProductCard
              product={item}
              isRecommended={
                recommendation != null &&
                item.title.toLowerCase().includes(
                  recommendation.productTitle.toLowerCase().substring(0, 30)
                )
              }
              recommendReason={recommendation?.reason}
              onLinkClick={onLinkClick}
              onSaveProduct={onSaveProduct}
            />
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
