import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, StatsCard, MiniStatsRow, RecentShops, FloatingActionButton } from '@/components/home';
import { useAuth } from '@/contexts/AuthContext';
import type { Shop } from '@/types';

const MOCK_SHOPS: Shop[] = [
  {
    id: '1',
    userId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    title: 'Nike Air Max 90',
    description: 'Classic sneakers',
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
  },
  {
    id: '2',
    userId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    title: 'Apple Watch Series 9',
    description: 'Smart watch',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    isFavorite: true,
    products: [
      {
        id: 'p3',
        shopId: '2',
        title: 'Apple Watch Series 9 GPS',
        price: '$399.00',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
        affiliateUrl: 'https://apple.com',
        source: 'Apple',
        isRecommended: true,
        rating: 4.9,
        reviewCount: 5621,
      },
    ],
    recommendation: {
      id: 'p3',
      shopId: '2',
      title: 'Apple Watch Series 9 GPS',
      price: '$399.00',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
      affiliateUrl: 'https://apple.com',
      source: 'Apple',
      isRecommended: true,
      rating: 4.9,
      reviewCount: 5621,
    },
  },
  {
    id: '3',
    userId: 'user1',
    imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400',
    title: 'Leather Backpack',
    description: 'Premium leather bag',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    isFavorite: false,
    products: [
      {
        id: 'p4',
        shopId: '3',
        title: 'Vintage Leather Backpack',
        price: '$89.99',
        imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200',
        affiliateUrl: 'https://amazon.com',
        source: 'Amazon',
        isRecommended: true,
        rating: 4.4,
        reviewCount: 1205,
      },
    ],
    recommendation: {
      id: 'p4',
      shopId: '3',
      title: 'Vintage Leather Backpack',
      price: '$89.99',
      imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200',
      affiliateUrl: 'https://amazon.com',
      source: 'Amazon',
      isRecommended: true,
      rating: 4.4,
      reviewCount: 1205,
    },
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const totalProducts = MOCK_SHOPS.reduce((acc, s) => acc + s.products.length, 0);
  const totalFavorites = MOCK_SHOPS.filter((s) => s.isFavorite).length;

  return (
    <View className="flex-1 bg-background-secondary">
      {/* Header */}
      <View
        className="bg-background"
        style={{ paddingTop: insets.top }}>
        <Header
          userName={profile?.name}
          userAvatar={profile?.avatarUrl}
        />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Stats Section */}
        <View className="bg-background-secondary pt-4">
          {/* Main Stats Card */}
          <StatsCard
            totalShops={MOCK_SHOPS.length}
            totalProducts={totalProducts}
            favorites={totalFavorites}
            thisWeek={2}
          />

          {/* Mini Stats Row */}
          <MiniStatsRow
            favorites={totalFavorites}
            products={totalProducts}
            savings={47}
          />
        </View>

        {/* Recent Shops */}
        <View className="bg-background-secondary">
          <RecentShops shops={MOCK_SHOPS} />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton />
    </View>
  );
}
