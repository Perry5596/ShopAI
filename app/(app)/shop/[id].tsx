import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ShopHeader, ProductImage, ProductLinks, ActionButtons } from '@/components/shop';
import { Badge } from '@/components/ui/Badge';
import type { Shop, ProductLink } from '@/types';

// Mock data - in a real app this would come from an API
const MOCK_SHOP: Shop = {
  id: '1',
  userId: 'user1',
  imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  title: 'Nike Air Max 90',
  description: 'Classic sneakers spotted',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isFavorite: false,
  products: [
    {
      id: 'p1',
      shopId: '1',
      title: 'Nike Air Max 90',
      price: '$129.99',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
      affiliateUrl: 'https://nike.com',
      source: 'Nike',
      isRecommended: true,
      rating: 4.8,
      reviewCount: 2341,
    },
    {
      id: 'p2',
      shopId: '1',
      title: 'Nike Air Max 90 Essential',
      price: '$119.99',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
      affiliateUrl: 'https://amazon.com',
      source: 'Amazon',
      isRecommended: false,
      rating: 4.5,
      reviewCount: 892,
    },
    {
      id: 'p3',
      shopId: '1',
      title: 'Nike Air Max 90 Premium',
      price: '$149.99',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
      affiliateUrl: 'https://footlocker.com',
      source: 'Foot Locker',
      isRecommended: false,
      rating: 4.7,
      reviewCount: 456,
    },
    {
      id: 'p4',
      shopId: '1',
      title: 'Nike Air Max 90 SE',
      price: '$139.99',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
      affiliateUrl: 'https://finishline.com',
      source: 'Finish Line',
      isRecommended: false,
      rating: 4.6,
      reviewCount: 234,
    },
  ],
  recommendation: {
    id: 'p1',
    shopId: '1',
    title: 'Nike Air Max 90',
    price: '$129.99',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
    affiliateUrl: 'https://nike.com',
    source: 'Nike',
    isRecommended: true,
    rating: 4.8,
    reviewCount: 2341,
  },
};

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [shop, setShop] = useState<Shop>(MOCK_SHOP);
  const [isFavorite, setIsFavorite] = useState(shop.isFavorite);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${shop.title} I found on Shop AI!`,
        title: shop.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleMenu = () => {
    Alert.alert(
      'Options',
      '',
      [
        { text: 'Edit Title', onPress: () => Alert.alert('Edit Title') },
        { text: 'Delete Shop', style: 'destructive', onPress: () => router.back() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
  };

  const handleDone = () => {
    router.back();
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <ShopHeader onShare={handleShare} onMenu={handleMenu} />

      {/* Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Product Image */}
        <ProductImage imageUrl={shop.imageUrl} />

        {/* Info Panel */}
        <View className="bg-background rounded-t-3xl -mt-6 pt-5 px-5">
          {/* Title Row */}
          <View className="flex-row items-start justify-between mb-2">
            {/* Favorite & Timestamp */}
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={handleFavoriteToggle}
                activeOpacity={0.7}
                className="mr-3">
                <Ionicons
                  name={isFavorite ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={isFavorite ? '#000000' : '#6B7280'}
                />
              </TouchableOpacity>
              <Badge text={formatTime(shop.createdAt)} variant="default" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-[24px] font-bold text-foreground mb-1">
            {shop.title}
          </Text>

          {shop.description && (
            <Text className="text-[14px] text-foreground-muted mb-4">
              {shop.description}
            </Text>
          )}
        </View>

        {/* Product Links */}
        <ProductLinks
          links={shop.products}
          recommendation={shop.recommendation}
        />
      </ScrollView>

      {/* Action Buttons */}
      <ActionButtons shopId={shop.id} onDone={handleDone} />
    </View>
  );
}
